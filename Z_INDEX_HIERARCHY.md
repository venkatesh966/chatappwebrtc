# 🔢 Z-Index Hierarchy Documentation

## 📊 **Current Z-Index Values**

This document outlines the z-index stacking order to prevent UI overlay conflicts.

### **Hierarchy (Lowest to Highest)**

| Component | Z-Index | Purpose | Notes |
|-----------|---------|---------|-------|
| **Chat Interface** | Default/Auto | Main chat container | Uses Material-UI elevation={8} |
| **Screen Share Viewer** | 1 (normal) / 1300 (fullscreen) | Video display | Higher when fullscreen |
| **Network Diagnostics** | 9998 | Diagnostic tool | Above main UI, below overlays |
| **Call Interface** | 9999 | Floating call controls | Always visible during calls |
| **Dialogs (Incoming)** | 10000 | Call/screen share requests | Critical user interactions |
| **Context Menus** | 10001 | Options/settings menus | Above all other elements |

## 🎯 **Z-Index Guidelines**

### **Layer Categories**
```
0-999:      Background & Main Content
1000-1999:  Secondary UI Elements  
2000-8999:  Reserved for Future Use
9000-9999:  Floating UI Components
10000+:     Critical Overlays & Modals
```

### **Specific Components**

#### **CallInterface.jsx**
```javascript
CallContainer: zIndex: 9999
- Fixed positioned floating control panel
- Needs to stay above chat interface
- Draggable, so must be above all main content

Dialogs: zIndex: 10000  
- Incoming call dialog
- Incoming screen share dialog
- Critical user decisions

Menu: zIndex: 10001
- Options menu from CallInterface
- Must be above dialogs to be accessible
```

#### **ScreenShareViewer.jsx**
```javascript
Normal Mode: zIndex: 1
- Regular screen share viewer
- Part of main content flow

Fullscreen Mode: zIndex: 1300
- Takes over entire screen
- Above most elements but below critical dialogs

Backdrop: zIndex: 1200
- Fullscreen background
- Below fullscreen viewer
```

#### **NetworkDiagnostics.jsx**
```javascript
Card: zIndex: 9998
- Diagnostic information panel
- Above main UI, below critical overlays
- Positioned relative for z-index to work
```

## 🛠️ **Best Practices**

### **Adding New Components**
1. **Identify the layer** your component belongs to
2. **Check existing z-index values** in this hierarchy
3. **Choose appropriate value** within the category range
4. **Update this documentation** with your changes

### **Common Ranges**
```javascript
// Main Content (0-999)
const MAIN_CONTENT = 1;
const ELEVATED_CONTENT = 100;

// Secondary UI (1000-8999)  
const FLOATING_PANELS = 1000;
const TOOLTIPS = 2000;

// Critical UI (9000+)
const OVERLAY_COMPONENTS = 9000;
const FLOATING_CONTROLS = 9999;
const MODAL_DIALOGS = 10000;
const CONTEXT_MENUS = 10001;
const EMERGENCY_OVERRIDE = 99999;
```

### **Material-UI Considerations**
```javascript
// Material-UI Default Z-Index Values:
AppBar: 1100
Drawer: 1200  
Modal: 1300
Snackbar: 1400
Tooltip: 1500

// Our custom values work around these defaults
```

## 🚨 **Troubleshooting Z-Index Issues**

### **Common Problems**
1. **Element appears behind others**
   - Check if parent has lower z-index
   - Ensure position is not static
   - Verify z-index value is high enough

2. **Z-Index not working**
   - Add `position: relative` or `position: absolute`
   - Check if parent creates new stacking context
   - Verify no CSS transforms are interfering

3. **Dialog/Modal behind other elements**
   - Use z-index 10000+ for critical interactions
   - Check Material-UI Portal rendering
   - Ensure proper Dialog/Modal usage

### **Debugging Commands**
```javascript
// Check element z-index in browser console
getComputedStyle(element).zIndex

// Find all elements with z-index
document.querySelectorAll('*').forEach(el => {
  const zIndex = getComputedStyle(el).zIndex;
  if (zIndex !== 'auto') console.log(el, zIndex);
});
```

## 📝 **Change Log**

### **2024-12-XX - Initial Z-Index Fix**
- **CallInterface**: 1000 → 9999 (fix overlay issue)
- **Dialogs**: Added zIndex: 10000
- **Menu**: Added zIndex: 10001  
- **NetworkDiagnostics**: Added zIndex: 9998

### **Future Changes**
- Document any z-index modifications here
- Include component name, old value, new value, and reason

---

**💡 Pro Tip**: When in doubt, use these safe ranges:
- **Floating panels**: 9000-9998
- **Critical dialogs**: 10000
- **Context menus**: 10001+ 