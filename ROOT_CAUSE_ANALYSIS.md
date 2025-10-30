# Root Cause Analysis: spriteSheetPath Parameter Error

## Problem Statement
Error: `invalid args 'spriteSheetPath' for command 'copy_sprite_sheet_to_location': command copy_sprite_sheet_to_location missing required key spriteSheetPath`

## Root Cause

### The Issue
**Serde's Default Serialization Behavior**

Rust's `serde` library, which handles serialization/deserialization between Rust and JavaScript in Tauri applications, has a default behavior that was causing the parameter mismatch:

1. **Rust Backend**: Defined parameters as `sprite_sheet_path` (snake_case)
2. **Serde Default**: Automatically converts snake_case to camelCase during serialization
3. **JavaScript Frontend**: Sent parameters as `sprite_sheet_path` (snake_case)
4. **Mismatch**: Tauri expected `spriteSheetPath` (camelCase) but received `sprite_sheet_path`

### Why This Happened

When Tauri processes command invocations:
1. Rust function parameters are defined in snake_case (Rust convention)
2. Serde serializes the parameter names for the JavaScript bridge
3. **By default**, Serde converts snake_case → camelCase for JavaScript compatibility
4. The frontend must send parameters matching Serde's output format

### The Confusion

- **Source Code**: Used `sprite_sheet_path` (correct for Rust)
- **Serde Output**: Converted to `spriteSheetPath` (automatic conversion)
- **Frontend**: Sent `sprite_sheet_path` (didn't match Serde's output)
- **Error**: Tauri couldn't find the required `spriteSheetPath` parameter

## Solution

### Fix Applied
Added `#[serde(rename_all = "snake_case")]` attribute to Rust structs:

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]  // ← This tells Serde to keep snake_case
pub struct SpriteSheetMetadata {
    pub sprite_sheet_path: String,
    pub metadata_path: String,
    // ...
}
```

This attribute tells Serde to:
- **Keep** snake_case field names during serialization
- **Not convert** to camelCase automatically
- **Match** what the frontend is sending

### Files Modified
1. `src-tauri/src/commands/character_extractor.rs`:
   - Added `#[serde(rename_all = "snake_case")]` to `SpriteSheetMetadata`
   - Added `#[serde(rename_all = "snake_case")]` to `CharacterSprite`

## Why Previous Attempts Didn't Work

### Attempt 1: Changed Frontend Parameter Names
- **What we did**: Changed frontend from `spriteSheetPath` to `sprite_sheet_path`
- **Why it failed**: Serde was still converting backend to `spriteSheetPath`
- **Result**: Mismatch persisted

### Attempt 2: Changed TypeScript Interface
- **What we did**: Updated interface to use `sprite_sheet_path`
- **Why it failed**: Didn't affect Serde's serialization behavior
- **Result**: Still had the mismatch

### Attempt 3: Cache Clearing
- **What we did**: Cleared all caches and rebuilt
- **Why it failed**: The issue was in Serde's behavior, not caching
- **Result**: Same error persisted

## Verification

### Before Fix
```
Frontend sends: { sprite_sheet_path: "..." }
Serde expects:  { spriteSheetPath: "..." }
Result: ❌ Error - parameter not found
```

### After Fix
```
Frontend sends: { sprite_sheet_path: "..." }
Serde expects:  { sprite_sheet_path: "..." }
Result: ✅ Success - parameters match
```

## Lessons Learned

1. **Serde Default Behavior**: Always be aware of Serde's default camelCase conversion
2. **Tauri Parameter Naming**: Use `#[serde(rename_all = "snake_case")]` for Rust-style naming
3. **Debugging**: Check serialization layer, not just source code
4. **Documentation**: Tauri/Serde interaction should be documented

## Prevention

### Best Practices
1. Always add `#[serde(rename_all = "snake_case")]` to Tauri command structs
2. Keep consistent naming between frontend and backend
3. Test command invocations immediately after adding new parameters
4. Document serialization behavior in code comments

## Related Documentation
- [Serde rename_all](https://serde.rs/container-attrs.html#rename_all)
- [Tauri Command Documentation](https://tauri.app/v2/guides/features/command/)

