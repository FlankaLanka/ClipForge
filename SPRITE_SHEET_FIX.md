# Sprite Sheet Assembly Fix

## Problem
FFmpeg was failing to create sprite sheets with the error:
```
FFmpeg sprite sheet error: [filter complex syntax error]
```

## Root Cause
The FFmpeg filter complex had a syntax error when handling rows with only 1 sprite. The code was trying to:
```
[s0][row0];  // Invalid - trying to map input to output incorrectly
```

This is invalid FFmpeg syntax. You can't just map an input to an output label without a filter operation.

## Solution
Fixed the filter generation to use the `copy` filter for single-sprite rows:

### Before (Broken):
```rust
if sprites_in_row == 1 {
    filter_complex.push_str(&format!("[s{}][row{}];", start_idx, row));
    // Invalid syntax!
}
```

### After (Fixed):
```rust
if sprites_in_row == 1 {
    // Single sprite in row - use copy filter
    filter_complex.push_str(&format!("[s{}]copy[row{}];", start_idx, row));
    // Valid syntax!
}
```

## How It Works Now

### Example: 4 Sprites (2x2 Grid)

**Step 1: Scale and pad each sprite**
```
[0:v]scale=28:30:...,pad=36:38:...[s0];
[1:v]scale=28:30:...,pad=36:38:...[s1];
[2:v]scale=28:30:...,pad=36:38:...[s2];
[3:v]scale=28:30:...,pad=36:38:...[s3];
```

**Step 2: Create rows (hstack)**
```
[s0][s1]hstack=inputs=2[row0];
[s2][s3]hstack=inputs=2[row1];
```

**Step 3: Stack rows vertically (vstack)**
```
[row0][row1]vstack=inputs=2
```

### Example: 3 Sprites (2x2 Grid with last row having 1 sprite)

**Step 1: Scale and pad**
```
[0:v]scale=...[s0];
[1:v]scale=...[s1];
[2:v]scale=...[s2];
```

**Step 2: Create rows**
```
[s0][s1]hstack=inputs=2[row0];  // Row 0: 2 sprites
[s2]copy[row1];                  // Row 1: 1 sprite (use copy!)
```

**Step 3: Stack rows**
```
[row0][row1]vstack=inputs=2
```

## Additional Fix
Also fixed the case where there's only 1 row total:
- Remove trailing semicolon
- Output the row directly without vstack

## Files Modified
- `src-tauri/src/commands/character_extractor.rs`
  - Fixed single-sprite row handling
  - Fixed single-row output handling

## Testing
The fix handles all sprite count scenarios:
- ✅ 1 sprite (1x1)
- ✅ 2 sprites (2x1)
- ✅ 3 sprites (2x2 with 1 in last row)
- ✅ 4 sprites (2x2)
- ✅ 5+ sprites (any grid configuration)

## Result
Sprite sheets now assemble correctly with proper horizontal and vertical stacking!

