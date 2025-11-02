# Terminology Migration Guide

## Overview

We've improved the attribute naming to be more intuitive and self-documenting. The new terminology makes it clearer what each attribute does.

## What Changed

### Attribute Renaming

| Old Attribute | New Attribute | Purpose |
|--------------|---------------|---------|
| `data-keys` | `data-groups` | Which highlight groups this element belongs to |
| `data-highlight-keys` | `data-activate` | Which groups to activate/highlight when clicked |
| `data-id` | `data-section` | Which content section this links to |

### Connector Property Renaming

| Old Property | New Property | Purpose |
|-------------|--------------|---------|
| `keys` | `groups` | Which highlight groups this connector belongs to |

## Why These Changes?

### 1. **`data-groups`** (formerly `data-keys`)
- **More descriptive**: "Groups" clearly indicates membership in logical groups
- **Self-documenting**: Immediately obvious that this element belongs to certain groups
- **Example**: `data-groups="workflow,database"` vs. `data-keys="A,B"`

### 2. **`data-activate`** (formerly `data-highlight-keys`)
- **Action-oriented**: The verb "activate" shows this is a trigger
- **Clearer intent**: Explicitly states that clicking activates certain groups
- **Example**: `data-activate="workflow"` - when clicked, activate the workflow group

### 3. **`data-section`** (formerly `data-id`)
- **Purpose-specific**: "Section" clearly indicates it links to a content section
- **Avoids confusion**: Distinct from HTML `id` attribute
- **Example**: `data-section="features-overview"` links to `<div id="features-overview">`

### 4. **`groups`** (formerly `keys` in connectors)
- **Consistent naming**: Matches `data-groups` attribute terminology
- **Consistent format**: Uses comma-separated string like other list attributes
- **Example**: `"groups": "workflow,database"`

## Migration Examples

### Before (Old Terminology)

```html
<!-- Scene with old attributes -->
<div class="scene" 
     data-keys="A,B"
     data-highlight-keys="A"
     data-nav-xyz="45.00.-35"
     data-id="cube1-description">
</div>

<!-- Connector with old property -->
<div class="isometric-perspective" 
     data-connectors='[
       {
         "from": "cube1",
         "to": "cube2",
         "color": "#4CAF50",
         "keys": ["A", "B"]
       }
     ]'>
</div>
```

### After (New Terminology)

```html
<!-- Scene with new attributes -->
<div class="scene" 
     data-groups="workflow,database"
     data-activate="workflow"
     data-nav-xyz="45.00.-35"
     data-section="cube1-description">
</div>

<!-- Connector with new property (string format) -->
<div class="isometric-perspective" 
     data-connectors='[
       {
         "ids": "cube1,cube2",
         "positions": "right,left",
         "color": "#4CAF50",
         "groups": "workflow,database"
       }
     ]'>
</div>

<!-- Connector with new property -->
<div class="isometric-perspective" 
     data-connectors='[
       {
         "ids": "cube1,cube2",
         "positions": "top,bottom",
         "color": "#4CAF50",
         "groups": ["workflow", "database"]
       }
     ]'>
</div>
```

## Backward Compatibility

**All old attributes are still supported!** You don't need to migrate immediately.

The library automatically checks for both old and new attributes:
- If `data-activate` is found, it's used; otherwise falls back to `data-highlight-keys`
- If `data-groups` is found, it's used; otherwise falls back to `data-keys`
- If `data-section` is found, it's used; otherwise falls back to `data-id`
- If `groups` property is found in connectors, it's used; otherwise falls back to `keys`

### Priority Order

When both old and new attributes exist, the **new attribute takes priority**:

```html
<!-- New attribute wins -->
<div class="scene" 
     data-groups="workflow"
     data-keys="A">  <!-- Ignored if data-groups exists -->
</div>
```

## Migration Strategy

### Recommended Approach

1. **Non-breaking change**: Update attributes at your own pace
2. **Test thoroughly**: Verify functionality with new attributes
3. **Gradual migration**: Update file by file or feature by feature
4. **Keep working**: Old attributes continue to function

### Quick Migration Script

You can use find-and-replace in your editor:

1. Find: `data-keys="`  
   Replace: `data-groups="`

2. Find: `data-highlight-keys="`  
   Replace: `data-activate="`

3. Find: `data-id="`  
   Replace: `data-section="`

4. Find: `"keys":`  
   Replace: `"groups":`

## Benefits of Migration

✅ **More intuitive code**: Easier to understand at a glance  
✅ **Better documentation**: Self-documenting attribute names  
✅ **Easier onboarding**: New developers understand the purpose immediately  
✅ **Clearer separation**: Distinct naming for groups vs. sections  
✅ **Professional terminology**: Industry-standard naming conventions  

## Questions?

- **Do I have to migrate?** No, old attributes work indefinitely
- **What if I mix old and new?** New attributes take priority
- **Will old attributes be removed?** Not in the foreseeable future
- **Can I use both?** Yes, but we recommend using only new attributes for clarity

## Complete Example

### Full Scene with New Terminology

```html
<div class="isometric-perspective" 
     data-connectors='[
       {
         "ids": "cube1,cube2",
         "positions": "center,top",
         "vertices": "50",
         "color": "#4CAF50",
         "groups": ["workflow"],
         "endStyles": ",arrow",
         "animationStyle": "circle"
       }
     ]'>
  
  <!-- Cube 1: Database component -->
  <div id="cube1" class="scene" 
       data-width="100" 
       data-height="100" 
       data-depth="100"
       data-groups="database,integration"
       data-activate="database">
    <div class="face front">Database</div>
    <div class="face top" 
         data-nav-xyz="45.00.-35" 
         data-nav-zoom="1.2"
         data-section="database-docs">
      Database Layer
    </div>
  </div>
  
  <!-- Cube 2: Workflow component -->
  <div id="cube2" class="scene" 
       data-groups="workflow"
       data-activate="workflow,integration">
    <div class="face top" 
         data-section="workflow-docs">
      Workflow Engine
    </div>
  </div>
</div>

<!-- Content sections -->
<div id="database-docs" class="description-section">
  <h2>Database Documentation</h2>
  <p>...</p>
</div>

<div id="workflow-docs" class="description-section">
  <h2>Workflow Documentation</h2>
  <p>...</p>
</div>
```

## CSS Classes Remain Unchanged

**Important:** CSS class names (`.highlight` and `.nav-selected`) were intentionally **not renamed** to maintain web development conventions and avoid breaking changes.

### Why CSS Classes Are Different

| Aspect | Data Attributes | CSS Classes |
|--------|----------------|-------------|
| **Purpose** | Configuration (what, why, when) | Presentation (how it looks) |
| **Naming** | Descriptive, purpose-specific | Semantic, state-based |
| **Example** | `data-activate`, `data-groups` | `.highlight`, `.active` |
| **Convention** | Describe relationships | Describe visual state |

### Separation of Concerns

```html
<!-- Attributes: Describe purpose and relationships -->
<div class="scene" 
     data-groups="workflow,database"
     data-activate="workflow"
     data-section="features">

<!-- CSS Classes: Describe visual state -->
<div class="scene highlight nav-selected">
```

This separation makes code **more clear**:
- **Attributes** = Configuration (what groups, what to activate, what section)
- **CSS Classes** = Presentation (is it highlighted? is it selected?)

### Benefits of Keeping `.highlight` and `.nav-selected`

✅ **Universal understanding**: Any developer knows what `.highlight` means  
✅ **Web conventions**: Follows standard CSS naming patterns  
✅ **No breaking changes**: Custom CSS continues to work  
✅ **Shorter names**: Less verbose, smaller DOM  
✅ **Semantic clarity**: Describes visual state, not the mechanism  

## Summary

The new terminology makes the library more intuitive and professional. While migration is optional due to full backward compatibility, we recommend adopting the new attribute names for better code clarity and maintainability.

**Key takeaway**: Use `data-groups`, `data-activate`, and `data-section` for new projects. Migrate existing projects at your convenience. CSS classes (`.highlight`, `.nav-selected`) remain unchanged to follow web development conventions.
