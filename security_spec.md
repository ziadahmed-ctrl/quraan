# Security Specification for Sakinah Tracker

## Data Invariants
1. Students cannot be created with invalid names (non-text) or ages out of standard ranges.
2. Attendance records must have rating scores strictly between 1 and 10.
3. Users cannot elevate their own role to GeneralSupervisor. Only existing GeneralSupervisors can modify roles.
4. Guest users (unauthenticated) can create and read records based on known IDs but cannot scrape full user lists.

## The "Dirty Dozen" Malicious Payloads
These payloads attempt to bypass identity or schema constraints and must return `PERMISSION_DENIED`:

1. **Guest Self-Elevation**: Unauthenticated user tries to register a profile in `/users/hackerDef` with role `GeneralSupervisor`.
2. **Hacker Self-Promotion**: Authenticated user `user123` tries to change their own role in `/users/user123` from `GroupSupervisor` to `GeneralSupervisor`.
3. **Invalid Student Age**: Create a student with negative age `age: -5`.
4. **Invalid Student Name Types**: Create a student with name as an array or object to poison queries.
5. **Score Boundary Violation (Too High)**: Create an attendance record with rating `20`.
6. **Score Boundary Violation (Too Low)**: Create an attendance record with rating `0`.
7. **Score Value Poisoning**: Create an attendance record with rating `"Excellent"` instead of a number.
8. **Student ID Injection Spoofing**: Injecting an ID with special characters like `/` or `..`.
9. **Supervising Cross-Contamination**: GroupSupervisor of Group A tries to delete a student assigned to GroupSupervisor of Group B.
10. **Hijacking Other Attendance Logs**: Guest tries to modify an attendance record owned by a logged-in supervisor.
11. **Client Timestamp Spoofing**: Uploading `createdAt` with a backdated timestamp instead of `request.time`.
12. **Scraping Users Collection**: Guest attempting to list the whole `/users` collection.
