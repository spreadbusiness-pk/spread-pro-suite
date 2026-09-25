# Fix form submission error overlay

## Goal
Keep every data-entry screen open when a save is rejected, show one clear notification, and preserve all existing permissions and page designs.

## Changes
- Add one shared mutation-error helper that converts server and database failures into safe, user-friendly messages without leaking technical details.
- Update each create, edit, delete, status-change, upload, and payment action to consume expected failures locally instead of allowing rejected promises to reach the app-level error overlay.
- Add missing error handling to branch activation/deactivation and sign-out actions.
- Keep the current admin-only branch rule unchanged; unauthorized users will see a normal notification and can continue using the page.

## Verification
- Submit a new branch while signed in as a non-admin and confirm the form stays visible with only the permission notification.
- Exercise one permitted save flow and confirm it completes normally.
- Check the desktop preview, browser errors, and the latest build result.

## Technical details
Expected server failures will be normalized at the mutation boundary. Route-level error handling remains reserved for genuine page-loading failures, while all user-triggered actions handle their own outcomes.
