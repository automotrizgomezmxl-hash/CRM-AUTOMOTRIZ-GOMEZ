# Security Specification for Automotriz Gomez CRM

## 1. Data Invariants
- **Vehicles**: Must have `make`, `model`, `year`, `price`, and `status`. `status` must be one of `available`, `reserved`, `sold`.
- **Leads**: Must have `customerName`, `status`, and `createdAt`. `status` must be one of `new`, `contacted`, `qualified`, `test-drive`, `negotiation`, `closed-won`, `closed-lost`.
- **Appointments**: Must have `leadId`, `date`, `type`, and `status`. `status` must be one of `scheduled`, `completed`, `cancelled`.
- **Sellers**: Must have `name`, `email`, and `role`. `role` must be `admin` or `user`.
- **Timestamps**: `createdAt` and `updatedAt` must be server-validated.

## 2. The "Dirty Dozen" Payloads (Targeting Rejection)
1. **Identity Spoofing**: Attempting to create a lead with a different `assignedTo` than the authenticated user (though currently using anonymous auth, we'll aim for `request.auth.uid` consistency if possible).
2. **State Shortcutting**: Updating a vehicle's `status` from `sold` back to `available` as a non-admin.
3. **Resource Poisoning**: Injecting 1MB of text into the `vin` or `customerName` field.
4. **ID Poisoning**: Using a document ID longer than 128 characters or containing malicious characters.
5. **PII Leak**: A sales agent trying to read the private `config` collection or other sellers' private data (if we isolate it).
6. **Immutable Field Write**: Trying to change the `createdAt` timestamp after creation.
7. **Future/Past Forgery**: Setting `updatedAt` to a client-side timestamp instead of `request.time`.
8. **Orphaned Writes**: Creating an appointment with a `leadId` that doesn't exist in the `leads` collection.
9. **Admin Escalation**: A user trying to update their own `role` in the `sellers` collection to `admin`.
10. **System Field Injection**: Trying to inject a field not defined in the schema (e.g., `isVerified: true`).
11. **Blanket Query**: Attempting to list all `leads` without being signed in.
12. **Malicious ID Injection**: Creating a document with a path-traversal-like ID.

## 3. Role-Based Access Reference
- **Admin**: Full CRUD on all collections.
- **User (Sales Agent)**: 
  - `vehicles`: Read-only.
  - `leads`: Create, Read (all), Update (if internal logic allows).
  - `appointments`: Create, Read, Update.
  - `sellers`: Read-only.
  - `config`: Read-only (public parts).
