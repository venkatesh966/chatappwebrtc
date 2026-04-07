# Contributing to NoBridge

Thanks for your interest in contributing.

## Before You Start

- Keep changes focused and easy to review.
- Avoid unrelated refactors in the same pull request.
- If you change behavior, explain why in the pull request description.
- Test your change locally before opening a pull request.

## Local Setup

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Reporting Bugs

When opening a bug report, include:

- browser and version
- operating system
- steps to reproduce
- expected behavior
- actual behavior
- screenshots or console errors if relevant

## Pull Request Guidelines

- Keep pull requests small and focused.
- Update docs when behavior or setup changes.
- Do not commit build output, local archives, or OS/editor junk files.
- Be careful with changes that may affect WebRTC behavior across browsers.

## Scope Notes

This project currently focuses on direct one-to-one communication:

- text chat
- file transfer
- audio calls
- screen sharing

If you want to propose a larger feature, open an issue first to discuss the approach.
