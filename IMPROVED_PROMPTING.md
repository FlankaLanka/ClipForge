# Improved Character Detection Prompting

## Problem Identified
The AI was detecting **blue sky blocks** instead of **Mario** because:
1. Prompt wasn't specific enough about what to ignore
2. No explicit instructions about background vs character
3. No size guidance (Mario is small, sky blocks are large)
4. No color/design matching emphasis with reference image

## Analysis of Your Example

**Reference Image**: 🍄 Clear Mario sprite (orange/red character)
**Video**: Mario gameplay with lots of blue sky/blocks
**Output**: ❌ Detected blue rectangles (background) instead of Mario

## Solution: Enhanced Prompting

### Key Improvements

#### 1. **Explicit Background Exclusion**
```
WHAT TO IGNORE:
- Sky, clouds, or background tiles (even if they're colored blocks)
- Static background elements
- Large colored blocks/rectangles (these are likely background)
- Platforms, ground, or level geometry
```

#### 2. **Size Guidance**
```
- The character is typically SMALL (16-64 pixels in retro games)
- If you see large colored blocks/rectangles, those are likely background - IGNORE them
```

#### 3. **Reference Image Emphasis** (When provided)
```
CRITICAL INSTRUCTIONS:
Image 1 (REFERENCE): This is the EXACT character you must find.
Image 2 (GAMEPLAY): Find ONLY this character in this frame.

The character MUST match the reference image's colors and design
```

#### 4. **Character Features**
```
WHAT TO LOOK FOR:
- A small animated sprite/character (usually 16-64 pixels)
- The PLAYER CHARACTER, not background elements
- Moving/animated elements, not static scenery
- Distinct character features (head, body, limbs)
- Characters usually have multiple colors and detailed sprites
```

#### 5. **Detection Rules**
```
1. The character MUST match the reference image's colors and design
2. The character is typically SMALL (16-64 pixels in retro games)
3. Look for the character sprite, not background elements
4. If you see large colored blocks/rectangles, those are likely background - IGNORE them
5. The character usually has distinct colors that stand out from the background
```

### Additional Technical Improvements

#### Lower Temperature
```json
"temperature": 0.1
```
- More deterministic responses
- Less creative interpretation
- More consistent detection

#### Increased Max Tokens
```json
"max_tokens": 300
```
- Allows AI more "thinking" space
- Better for complex scenes

#### High Detail Mode
```json
"detail": "high"
```
- Better image analysis
- More accurate small sprite detection

## Before vs After

### Before (Bad Prompt):
```
"Find the character from the reference image in the gameplay frame 
and return the bounding box coordinates."
```

**Result**: Detects blue sky blocks ❌

### After (Improved Prompt):
```
CRITICAL INSTRUCTIONS:

Image 1 (REFERENCE): This is the EXACT character you must find.
Image 2 (GAMEPLAY): Find ONLY this character in this frame.

WHAT TO LOOK FOR:
- The character from the reference image (same colors, same shape, same design)
- A small animated sprite/character (usually 16-64 pixels)
- The PLAYER CHARACTER, not background elements

WHAT TO IGNORE:
- Sky, clouds, or background tiles (even if they're colored blocks)
- Static background elements
- Large colored blocks/rectangles (these are likely background)

DETECTION RULES:
1. The character MUST match the reference image's colors and design
2. The character is typically SMALL (16-64 pixels in retro games)
3. If you see large colored blocks/rectangles, those are likely background - IGNORE them
...
```

**Result**: Should detect Mario correctly ✅

## Why This Works

### 1. **Explicit Negatives**
- Tells AI what NOT to detect
- Specifically mentions "large colored blocks" (the blue sky issue)
- Emphasizes "background" vs "character"

### 2. **Size Context**
- "16-64 pixels" gives concrete size expectations
- Helps distinguish small character from large background elements
- Mario is ~16-32 pixels, sky blocks are much larger

### 3. **Reference Matching**
- Emphasizes "EXACT character" and "MUST match"
- Focuses on colors and design from reference
- Reduces false positives from similar-colored elements

### 4. **Structured Instructions**
- Clear sections: WHAT TO LOOK FOR, WHAT TO IGNORE, DETECTION RULES
- Numbered rules for clarity
- Repeated emphasis on key points

### 5. **Game-Specific Knowledge**
- Mentions "retro games" context
- References typical sprite sizes
- Acknowledges "animated" vs "static" distinction

## Testing Recommendations

### Test with Your Mario Video:

1. **Upload the Mario reference image** (the 🍄 sprite you showed)
2. **Use these settings**:
   - FPS: 5 (good balance)
   - Batch Size: 5 (moderate speed)
   - Reference Image: ✅ ENABLED

3. **Expected Results**:
   - ✅ Detects Mario (orange/red character)
   - ❌ Ignores blue sky blocks
   - ✅ Detects Mario in different poses
   - ❌ Ignores background elements

### If Still Detecting Background:

Additional options to try:
1. **Crop the reference image** to show ONLY Mario (no background)
2. **Use higher FPS** (10) to get more frames where Mario is visible
3. **Try sequential processing** (batch size 1) for more careful analysis
4. **Check frame preview** during processing to see what's being detected

## Files Modified

- `src-tauri/src/commands/character_extractor.rs`
  - Enhanced prompt with explicit background exclusion
  - Added size guidance (16-64 pixels)
  - Emphasized reference image matching
  - Added structured detection rules
  - Increased max_tokens to 300
  - Added temperature: 0.1 for consistency

## Next Steps

1. **Restart the app** to load new prompts
2. **Test with Mario video** using reference image
3. **Monitor console logs** to see what's being detected
4. **Check frame preview** during processing
5. **Verify sprite sheet** shows Mario, not sky blocks

## If Problems Persist

Consider these additional improvements:
- Pre-process reference image to remove background
- Add negative examples ("NOT like this")
- Use object detection model instead of Vision API
- Implement color-based filtering (look for Mario's colors)
- Add motion detection (character moves, background doesn't)

---

**The key insight**: The AI needs explicit instructions about what to IGNORE, not just what to FIND. Background elements can be visually prominent but should be excluded based on size, static nature, and lack of character features.

