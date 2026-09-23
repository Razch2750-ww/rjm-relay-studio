# RJM Relay Studio

Operate surface for Rey: build a circuit, connect actual terminals, run it, inspect faults.
The supplied Simurelay screenshots establish an engineering editor. The expanded brief requests a light CAD sheet inside compact dark tool chrome.

- Light gray drawing sheet; slate tool panes; muted green run control; black editing wires and green energized paths. Use a gap at non-connected crossings and explicit junction dots.
- Neutral sans interface, monospace only for terminal IDs, tags and measurement values.
- One compact header, sheet toolbar, left component palette, center SVG canvas, right inspector.
- Each edge can collapse independently. Keep narrow restore controls, sheet navigation and run/pause visible. Focus folds all four edges; exiting restores the previous layout. Remember panel preferences per browser without changing projects, camera or pending wires.
- 1440px desktop target. Below 900px prioritize viewing/simulation; editing controls remain on desktop.
- 14px normal UI labels, 16px body, visible keyboard focus, 44px mobile controls.
- Native SVG electrical geometry; no generated illustrations, gradients or decorative cards.
- Symbol rotation moves the terminals and annotation positions while lettering stays upright. Place wrapped descriptions clear of component bodies, terminal IDs, labels and actual wire segments; include annotations in fit, print and SVG bounds.
- Active conductors show line weight and green status. Faults use red and text; source phase remains available in terminal labels, inspector and debug information.
- Power, Control, Front Panel, Panel Internal and Simulation share device IDs. Physical panel dimensions use millimeters, with editable cutouts, rails, ducts and collision warnings.
- Simulation uses a Web Worker with at most one pending tick. Ignore stale results after an operation/edit, and show actual virtual time at accelerated speeds.
- Engineering tools use flat light surfaces, tabular figures, compact forms and scrollable tables. Keep all Run/Pause and restore controls accessible.
- Reduced motion supported. Print output is light and isolates the circuit.

Business truth: educational circuit engine with explicit numerical-model limits, not an installation approval tool.
