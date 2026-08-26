# Program Monitor playback-stuck fix

The Program Monitor video renderer now keeps its media event wiring stable while the timeline playhead advances. During playback, the native `<video>` element owns continuous frame progression and the timeline clock only corrects meaningful drift. Paused scrubbing still performs tight frame-accurate seeks.

This prevents repeated effect teardown from cancelling decoded-frame callbacks and leaving the preview visually stuck on the poster or last revealed frame.
