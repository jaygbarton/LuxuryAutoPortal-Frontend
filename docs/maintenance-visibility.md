# Maintenance reservation cards

The backend groups display cards by vehicle and reservation, preserving each
original issue report and its independent status, appointment, files and notes.
A repeated open issue spanning trips remains one card with all reservation
numbers displayed. Moving from Car Issues or Turo Messages provides a persistent
“View in Maintenance” link to the containing card, even when that card's oldest
report belongs to a different trip.

The linked view opens the individual reports, bypasses unrelated UI filters,
and survives refresh. Authorization remains on the backend. Fleet search loads
all returned pages; location and date filters consider every reporting trip.
Use `?tab=maintenance&search=61832465` to open a reservation search.

Playwright tests cover the move action, direct report link, grouped original
notes/files/edit controls, refresh, and 390/1280px layouts. These tests use
constructed data and do not certify the contents of private production records.
