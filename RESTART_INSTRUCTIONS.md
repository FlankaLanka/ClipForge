# Browser Cache Issue - How to Fix

The code has been updated correctly, but your browser is using cached JavaScript with the old parameter names.

## Solution: Hard Refresh the Browser

### Option 1: Hard Refresh (Recommended)
1. **Stop the Tauri app** if it's running
2. **Rebuild**: Run `npm run build` in the terminal
3. **Restart the Tauri app**: Run `npm run tauri dev`
4. **Hard refresh the browser**:
   - **Mac**: `Cmd + Shift + R` or `Cmd + Option + R`
   - **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`

### Option 2: Clear Browser Cache
1. Open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Option 3: Restart Everything
```bash
# Kill any running processes
pkill -f tauri

# Clean build
rm -rf dist
npm run build

# Restart dev server
npm run tauri dev
```

## Verify It's Working
After restarting, check the browser console. You should see:
```
Sprite sheet path: /var/folders/.../character_spritesheet.png
Metadata path: /var/folders/.../character_spritesheet.json
```

The save operation should now work without the `spriteSheetPath` error.

## Technical Details
- **Old code**: Used `spriteSheetPath` (camelCase)
- **New code**: Uses `sprite_sheet_path` (snake_case) to match Rust backend
- **Issue**: Browser cached the old JavaScript bundle

