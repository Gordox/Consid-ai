# endpoint-check — Project Scope and Development Guidelines

## Project

Build a small Go CLI that checks whether HTTP endpoints respond as expected after a deployment. It helps developers and operations teams verify several services with one command, locally or in CI, instead of checking each service manually.

The goal is a complete, documented v1.0 that someone else can install and use, achievable within six weeks alongside full-time work. Success means using the tool in at least one real deployment workflow. A passing check confirms HTTP availability and the expected status; it does not prove that every service feature works.

### Initial scope: v1.0

- Accept one or more URLs through a repeatable `--url` flag.
- Send one HTTP GET request per URL, sequentially, in input order.
- Compare each response with `--expect-status`, defaulting to `200`. This setting applies to every URL in the invocation.
- Measure elapsed time from starting the request until response headers arrive, including connection setup. Report milliseconds.
- Apply a positive per-request `--timeout`, defaulting to `5s`.
- Support `--format text` and `--format json`, defaulting to text.
- Report each URL, pass/fail result, received status when available, elapsed time, and a useful error when applicable.
- Continue checking the remaining URLs after an individual endpoint fails.
- Provide `--help` and documented exit codes for CI integration.
- Distribute versioned Linux and macOS binaries, initially for amd64 and arm64, with checksums and installation instructions.

### Outside v1.0

No web interface, HTTP server, database, accounts, scheduled monitoring, alerting, history, retries, concurrent checks, custom authentication, response-body assertions, or configuration files. Additions require an explicit scope decision.

## Technology Stack

- **Go:** use the current stable release when initializing the repository. Record the minimum supported Go version in `go.mod` and align CI with it. Go suits a small CLI with a straightforward build and distribution process.
- **Go modules:** one module, using the actual GitHub repository path.
- **Standard library only initially:** `flag` for arguments, `net/http` for requests, `net/url` for URL parsing, `context` for cancellation, `time` for timing, and `encoding/json` for JSON output.
- **Standard testing tools:** `testing` and `net/http/httptest` for deterministic tests without public network access.
- **GitHub Actions and Releases:** automate checks and publish downloadable binaries. No third-party release tool is required initially.

Gin is not needed: this project makes HTTP requests and does not serve them.

## Architecture Principles

- Keep one executable and a small number of focused internal packages. Do not introduce framework-style layers without a concrete need.
- Keep `main` thin: wire dependencies, create the cancellation context, invoke the CLI, then exit with its returned code. Only `main` calls `os.Exit`.
- `cli` parses and validates arguments, coordinates checks, and selects the exit code. Use a local `flag.FlagSet`, not package-level flags.
- `check` owns HTTP communication and typed check results. It must not read command-line arguments, print output, or terminate the process.
- `output` formats results to an injected `io.Writer`. It must not make HTTP requests or decide whether an endpoint passes.
- Keep validation and status evaluation deterministic. Pass configuration, the HTTP client, and output writers explicitly.
- No mutable global state, hidden initialization, or `init()` functions. Constants are fine.
- Accept `context.Context` as the first parameter of operations that can block. Propagate cancellation and stop starting new checks after cancellation.
- Prefer concrete types. Introduce small interfaces at their point of use only when they solve an actual substitution or testing need.
- Use small functions, early returns, descriptive names, and explicit control flow. Avoid generic `utils`, `helpers`, or `manager` packages.

## CLI Contract and Validation

Planned interface:

```bash
endpoint-check \
  --url https://api.example.com/health \
  --url https://auth.example.com/health \
  --expect-status 200 \
  --timeout 5s \
  --format json
```

- Validate all arguments before making any network request.
- Require at least one absolute HTTP or HTTPS URL with a valid host. Reject URL credentials and fragments. If a port is supplied, require a numeric value from 1 to 65535.
- Require an expected status between 100 and 599, a valid positive Go duration, and a supported output format.
- Reject unknown flags and unexpected positional arguments.
- Do not follow redirects: evaluate the original endpoint's response status. Configure this explicitly on the HTTP client.
- Keep TLS certificate verification enabled. Do not add an insecure mode.
- Reuse a configured HTTP client, close every response body, and do not download response bodies for these status-only checks.
- Write results to stdout and command-level diagnostics to stderr. A failed endpoint is a normal check result, not a program panic.
- JSON output must be one valid document with a `results` array and an `all_passed` boolean. Each result has `url`, `passed`, `status_code`, `duration_ms`, and `error`; use null for unavailable status codes and absent errors.
- Preserve result order. Do not mix progress messages or other text into JSON stdout.
- URLs can contain sensitive query values. Redact query values in displayed URLs and sanitize errors; never echo raw transport errors that expose those values.

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | All checks passed, or help was requested. |
| `1` | At least one endpoint failed or returned an unexpected status. |
| `2` | Invalid arguments or an internal/output failure prevented a valid command result. |
| `130` | Interrupted by the user. |

## Code Conventions and Error Handling

- Format all Go source with `gofmt`.
- Use idiomatic Go names: short lowercase package names, MixedCaps identifiers, and consistent initialisms such as `URL`, `HTTP`, and `JSON`.
- Keep implementation details unexported unless another package needs them.
- Document exported declarations when useful; comments should explain intent, constraints, or non-obvious behavior rather than repeat the code.
- Use typed structs for options and results. Avoid `any`, reflection, and generic abstractions when concrete types suffice.
- Return errors explicitly. Add context with wrapping when callers need the underlying error; use `errors.Is` and `errors.As` instead of matching error messages.
- Never swallow errors or panic for invalid input, network failures, or other expected operational failures.
- Handle output-writing errors as well as request errors.

## Planned Folder Structure

This is the intended layout, not a claim that these files already exist. Add files as their functionality is implemented; avoid empty scaffolding.

```text
.
├── CLAUDE.md
├── README.md
├── LICENSE                     # Select the license with the project owner
├── .gitignore
├── go.mod
├── cmd/
│   └── endpoint-check/
│       └── main.go             # Process entry point and dependency wiring
├── internal/
│   ├── cli/
│   │   ├── run.go              # Arguments, orchestration, and exit codes
│   │   └── run_test.go
│   ├── check/
│   │   ├── checker.go          # HTTP checks and typed results
│   │   ├── checker_test.go
│   │   ├── validate.go         # Endpoint and check-option validation
│   │   └── validate_test.go
│   └── output/
│       ├── format.go           # Text and JSON output
│       └── format_test.go
└── .github/
    └── workflows/
        ├── ci.yml              # Formatting, vet, tests, and build
        └── release.yml         # Versioned binaries and checksums
```

Use `cmd/` for the executable and `internal/` for implementation packages. Keep `_test.go` files beside the code they test; no separate top-level test directory is needed. Add `testdata/` within a package only if fixtures are useful. Let Go generate `go.sum` if approved dependencies require it; do not create an empty one manually.

## Agent Rules

- Do not add or replace dependencies, developer tools, or third-party CI actions without asking. Prefer the standard library.
- Do not expand scope or add out-of-scope features without approval.
- Do not change documented flags, defaults, exit codes, or JSON fields without approval.
- Do not add a database, server framework, dependency-injection container, plugin system, or public library API.
- Do not disable TLS verification, remove timeouts, hide failures, or add unbounded background work.
- Do not commit secrets, tokens, private service URLs, generated binaries, or local machine settings.
- Do not create configuration or environment files for functionality that does not exist.
- Do not make unrelated refactors, rewrite history, force-push, or push directly to the default branch. Work in feature branches.
- Do not weaken or delete tests simply to make a check pass.
- Do not publish releases or choose a license without the project owner's approval.
- Do not claim a command passed unless it was run successfully. State any verification that could not be performed.
- Keep this file and the README aligned with deliberate scope and interface changes.

## Setup, Run, and Build

These commands apply once the corresponding implementation exists. Replace `YOUR_GITHUB_USERNAME` with the actual repository owner before initializing the module. Run initialization only if `go.mod` does not exist.

```bash
go mod init github.com/YOUR_GITHUB_USERNAME/endpoint-check
```

Run from source:

```bash
go run ./cmd/endpoint-check --url https://example.com --timeout 5s
```

Build and run the executable:

```bash
go build -o endpoint-check ./cmd/endpoint-check
./endpoint-check --url https://example.com --format json
```

Use the built binary in CI when checking exact exit codes; `go run` is a development convenience.

## Verification

```bash
gofmt -w .
go vet ./...
go test ./...
go test -race ./...
go build ./...
```

- Write focused tests alongside each feature. Use table-driven tests where cases share the same behavior.
- Use local `httptest` servers for expected and unexpected statuses, redirects, and TLS behavior. Keep tests independent of public services.
- Cover invalid arguments, multiple URLs, timeouts, cancellation, connection failures, output errors, JSON structure, URL redaction, and exit-code selection.
- Avoid fragile timing assertions and long sleeps. Use controlled handlers and reasonable tolerances for timeout tests.
- CI must check formatting without rewriting files, run vet and tests, and build the executable. Run the race detector on a supported runner.

## Definition of Done: v1.0

- Every in-scope feature works and is covered by meaningful tests.
- Formatting, vet, tests, race checks, and builds pass in CI.
- README explains installation, flags, defaults, redirect behavior, timing semantics, JSON output, exit codes, and limitations.
- README includes a working CI example and instructions for checking multiple services.
- A versioned GitHub Release provides the documented binaries and checksums.
- A user can download a binary and perform a check without installing Go.
- The tool has been used in at least one real deployment workflow.
- No placeholder implementation remains in the released feature set.

## Official Go References

- Module layout: https://go.dev/doc/modules/layout
- Go modules: https://go.dev/doc/modules/gomod-ref
- Standard library: https://pkg.go.dev/std
- Release history: https://go.dev/doc/devel/release

Use official Go guidance and keep the layout proportional to this project; there is no need to adopt a large repository template.
