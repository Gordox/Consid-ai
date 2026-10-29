"""Request body limit and processing concurrency."""

import asyncio
import json
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Two photos plus multipart overhead and form fields.
MULTIPART_OVERHEAD_BYTES = 256 * 1024


class BodyTooLargeError(Exception):
    pass


class BodyLimitMiddleware:
    """Gives each request an id and stops reading its body once it exceeds the limit, whether or
    not the client sent a Content-Length (React Native may stream multipart uploads)."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        started = False

        async def tracked_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise BodyTooLargeError
            return message

        try:
            for name, value in scope.get("headers", []):
                if name == b"content-length" and value.isdigit() and int(value) > self.max_bytes:
                    raise BodyTooLargeError
            await self.app(scope, limited_receive, tracked_send)
        except BodyTooLargeError:
            if started:
                raise
            body = json.dumps(
                {
                    "code": "payloadTooLarge",
                    "message": "The photos are larger than the service accepts (15 MB each).",
                    "requestId": request_id,
                }
            ).encode()
            await tracked_send(
                {
                    "type": "http.response.start",
                    "status": 413,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                        (b"connection", b"close"),
                    ],
                }
            )
            await tracked_send({"type": "http.response.body", "body": body})


class BusyError(Exception):
    pass


class ProcessingTimeoutError(Exception):
    pass


class AnalysisRunner:
    """Runs CPU-bound analysis in worker threads, at most `slots` at a time. A slot is released
    only when the work really ends, even after the caller timed out, so timed-out work can never
    pile up beyond the limit."""

    def __init__(self, slots: int, timeout_s: float) -> None:
        self._executor = ThreadPoolExecutor(max_workers=slots, thread_name_prefix="analysis")
        self._free = slots
        self._timeout_s = timeout_s

    async def run[T](self, work: Callable[[], T]) -> T:
        if self._free <= 0:
            raise BusyError
        self._free -= 1
        loop = asyncio.get_running_loop()
        future = loop.run_in_executor(self._executor, work)

        def release(_: Any) -> None:
            self._free += 1

        future.add_done_callback(release)
        try:
            return await asyncio.wait_for(asyncio.shield(future), self._timeout_s)
        except TimeoutError as error:
            raise ProcessingTimeoutError from error

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
