import asyncio
import threading

import pytest

from app.api.limits import AnalysisRunner, BusyError, ProcessingTimeoutError


def test_runner_refuses_work_beyond_its_slots_and_frees_them_when_work_ends() -> None:
    async def scenario() -> None:
        runner = AnalysisRunner(slots=1, timeout_s=5)
        release = threading.Event()
        first = asyncio.create_task(runner.run(lambda: release.wait(5)))
        await asyncio.sleep(0.05)
        with pytest.raises(BusyError):
            await runner.run(lambda: 1)
        release.set()
        assert await first is True
        await asyncio.sleep(0.05)
        assert await runner.run(lambda: 2) == 2
        runner.shutdown()

    asyncio.run(scenario())


def test_timed_out_work_keeps_its_slot_until_it_really_ends() -> None:
    async def scenario() -> None:
        runner = AnalysisRunner(slots=1, timeout_s=0.05)
        release = threading.Event()
        with pytest.raises(ProcessingTimeoutError):
            await runner.run(lambda: release.wait(5))
        with pytest.raises(BusyError):
            await runner.run(lambda: 1)
        release.set()
        await asyncio.sleep(0.05)
        assert await runner.run(lambda: 3) == 3
        runner.shutdown()

    asyncio.run(scenario())
