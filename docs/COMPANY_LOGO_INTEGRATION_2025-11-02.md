# Company Logo Integration

**Date:** November 2, 2025  
**Feature:** Company Logo Display Throughout PR/PO System  
**Status:** ✅ SPECIFIED

## Overview

Integrate company logo throughout the PR/PO system for professional branding, including:
- Web application header/navigation
- Dashboard and PR/PO views
- Generated PO PDF documents
- Email notifications (optional)

## Current Logo Details

**1PWR Africa Logo:**
- **Source:** https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png
- **Format:** PNG (excellent choice for both web and PDF)
- **Current Use:** Company website
- **Suitability:** ✅ Perfect for system integration

### Why This Logo Works

✅ **PNG Format** - Supports transparency, ideal for various backgrounds  
✅ **Professional Quality** - High-resolution, suitable for print  
✅ **Web-Optimized** - Already served from website, fast loading  
✅ **Scalable** - Can be resized for different contexts  

## Implementation Strategy

### Option 1: Direct URL Reference (Recommended for Quick Start)

**Advantages:**
- ✅ No file upload needed
- ✅ Logo already hosted on your website
- ✅ Easy to update (change website logo, system updates automatically)
- ✅ Reduces storage costs

**Considerations:**
- ⚠️ Requires internet connection for PO PDF generation
- ⚠️ Dependent on website availability
- ⚠️ Should cache logo for PDF generation

**Implementation:**
```typescript
organization.companyLogo = "https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png"
organization.companyLogoWidth = 200 // pixels
organization.companyLogoHeight = null // auto (maintains aspect ratio)
```

### Option 2: Firebase Storage Upload (Recommended for Production)

**Advantages:**
- ✅ Full control over logo files
- ✅ Better performance (same infrastructure as app)
- ✅ Works offline if cached
- ✅ Version control (keep multiple versions)
- ✅ No external dependencies

**Implementation:**
1. Admin uploads logo in Organization Settings
2. Logo stored in Firebase Storage: `/organizations/{orgId}/logo.png`
3. Public URL generated and saved to organization document
4. System references stored URL

**Firebase Storage Path Structure:**
```
/organizations/
  └── {organizationId}/
      ├── logo.png (current logo)
      ├── logo_v1.png (previous version - optional)
      └── logo_v2.png (previous version - optional)
```

### Option 3: Hybrid Approach (Best of Both Worlds)

1. **Initial Setup:** Use direct URL from website
2. **Long-term:** Add option in Admin UI to upload logo to Firebase
3. **Fallback:** If Firebase logo fails, fall back to website URL
4. **Flexibility:** Support both URL reference and uploaded files

## Logo Usage Locations

### 1. Web Application Header

**Location:** Top navigation bar (left side)  
**Size:** 150-180px wide × auto height  
**Background:** Dark or light (logo should have transparent background)

**Implementation:**
```tsx
<AppBar>
  <img 
    src={organization.companyLogo} 
    alt={organization.name}
    style={{ height: '40px', width: 'auto' }}
  />
  <Typography variant="h6">{organization.name}</Typography>
</AppBar>
```

### 2. Dashboard

**Location:** Top-left corner or above metrics panel  
**Size:** 120-150px wide × auto height  
**Purpose:** Reinforce branding, especially for multi-organization users

### 3. PR/PO View Pages

**Location:** Header section (top-left)  
**Size:** 100-120px wide × auto height  
**Purpose:** Professional appearance, clear organization identification

### 4. PO PDF Document

**Location:** Top-left of document header  
**Size:** 180-220px wide × auto height (recommended: 200px)  
**Quality:** High resolution for printing

**PDF Layout:**
```
┌────────────────────────────────────────────────┐
│ [Company Logo]        PURCHASE ORDER           │
│                       PO#: ORG-202511-001      │
│                       Date: Nov 2, 2025        │
├────────────────────────────────────────────────┤
│ ...rest of PO...                               │
```

### 5. Email Notifications (Optional)

**Location:** Email header/footer  
**Size:** 120-150px wide × auto height  
**Purpose:** Professional branded emails

## Type Definitions

### Organization Type

**File:** `src/types/organization.ts`

```typescript
export interface Organization {
  // ... other fields ...
  
  // Company Logo
  companyLogo?: string; // URL or Firebase Storage path
  companyLogoWidth?: number; // Width in pixels (default: 200 for PO)
  companyLogoHeight?: number; // Height in pixels (default: auto)
  
  // ... other fields ...
}
```

### Default Values

```typescript
const DEFAULT_LOGO_WIDTH = 200; // For PO documents
const DEFAULT_LOGO_HEIGHT = null; // Auto (maintains aspect ratio)
```

## Admin Portal UI

### Organization Settings Page

**New Section:** "Company Branding"

```
Company Logo
  Current Logo:
  ┌─────────────────┐
  │                 │
  │  [Logo Preview] │
  │                 │
  └─────────────────┘
  
  Logo Source:
  ○ URL: [https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png]
     [Test URL] - verifies logo loads
  
  ○ Upload File:
     [Choose File] [Upload]
     Recommended: PNG or JPG, 200-400px wide, max 2MB
  
  Logo Display Settings (for PO documents):
    Width: [200] pixels
    Height: [Auto ▼] (maintains aspect ratio)
  
  [Preview on PO] - shows how logo appears on PO
  
  [Save Logo Settings]
```

### Logo Upload Validation

**Requirements:**
- File types: PNG (preferred), JPG, JPEG, SVG
- Max file size: 2MB
- Recommended width: 200-400px
- Recommended DPI: 300 for print quality
- Transparent background (PNG) recommended

**Validation Messages:**
- ✅ "Logo uploaded successfully"
- ⚠️ "Logo file size exceeds 2MB. Please compress and try again."
- ⚠️ "Invalid file type. Please upload PNG, JPG, or SVG."
- ⚠️ "Logo dimensions too small. Recommended minimum: 200px wide."

## PDF Generation Implementation

### HTML to PDF Approach

**Template with Logo:**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .po-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .company-logo {
      max-width: 200px;
      height: auto;
    }
    .po-title {
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="po-header">
    <img src="{{companyLogo}}" alt="{{companyName}}" class="company-logo" />
    <div class="po-title">
      <h1>PURCHASE ORDER</h1>
      <p>PO#: {{poNumber}}</p>
      <p>Date: {{issueDate}}</p>
    </div>
  </div>
  <!-- Rest of PO content -->
</body>
</html>
```

### Logo Loading Strategy

```typescript
async function generatePO(poData: PRRequest, organization: Organization) {
  // 1. Get logo URL
  const logoUrl = organization.companyLogo;
  
  // 2. Cache logo locally for PDF generation (if URL)
  const cachedLogoPath = await cacheLogoForPDF(logoUrl);
  
  // 3. Generate PDF with local logo path
  const pdfOptions = {
    format: 'A4',
    printBackground: true
  };
  
  // 4. Populate template
  const html = populatePOTemplate({
    ...poData,
    companyLogo: cachedLogoPath,
    companyName: organization.companyLegalName || organization.name
  });
  
  // 5. Convert to PDF
  const pdf = await htmlToPdf(html, pdfOptions);
  
  return pdf;
}

async function cacheLogoForPDF(logoUrl: string): Promise<string> {
  // Download logo to temporary location
  // Or use data URI: data:image/png;base64,...
  // Returns local path or data URI for reliable PDF generation
}
```

## Logo Best Practices

### For Web Display

✅ **DO:**
- Use PNG with transparent background
- Optimize file size (use tools like TinyPNG)
- Set appropriate width/height to prevent layout shift
- Add alt text for accessibility
- Test on various screen sizes

❌ **DON'T:**
- Use huge uncompressed images
- Forget to set dimensions (causes layout shift)
- Use white background (may clash with light themes)

### For PDF Documents

✅ **DO:**
- Use high-resolution logo (300 DPI preferred)
- Maintain aspect ratio
- Position consistently (top-left recommended)
- Test print appearance
- Ensure logo is readable when printed in grayscale

❌ **DON'T:**
- Stretch or distort logo
- Make logo too large (overwhelms document)
- Use low-resolution images (pixelated when printed)

### For Email

✅ **DO:**
- Use hosted logo (not attachment) for email size
- Add alt text for email clients that block images
- Link logo to company website (optional)
- Keep file size small (<100KB)

❌ **DON'T:**
- Embed large images (increases email size)
- Use complex SVGs (not supported by all email clients)

## Migration Plan

### Phase 1: Add Logo Support

1. ✅ Update Organization type with logo fields
2. ✅ Update Specifications
3. ⏳ Add Admin UI for logo configuration
4. ⏳ Add logo display in web header

### Phase 2: Initial Configuration

1. ⏳ Admin enters logo URL in Organization Settings
2. ⏳ Test logo display in web application
3. ⏳ Verify logo appears correctly

### Phase 3: PO Integration

1. ⏳ Update PO PDF template to include logo
2. ⏳ Implement logo caching for PDF generation
3. ⏳ Test PO generation with logo
4. ⏳ Print test to verify quality

### Phase 4: Enhancement (Optional)

1. ⏳ Add file upload capability
2. ⏳ Implement Firebase Storage integration
3. ⏳ Add logo to email notifications
4. ⏳ Support multiple logo versions/sizes

## Testing Scenarios

### Test 1: Logo URL Configuration
1. Admin enters logo URL: https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png
2. Save organization settings
3. **Expected:** Logo displays in header

### Test 2: Logo in PO Document
1. Generate PO for approved PR
2. Download PDF
3. **Expected:** Logo appears in top-left of PO
4. **Expected:** Logo is clear and professional quality

### Test 3: Logo Size Adjustment
1. Set logo width to 150px
2. Generate PO
3. **Expected:** Logo scales to 150px width
4. Set logo width to 250px
5. **Expected:** Logo scales to 250px width

### Test 4: Missing Logo Handling
1. Remove logo URL from organization
2. Navigate to dashboard
3. **Expected:** No broken image, either show placeholder or just company name
4. Generate PO
5. **Expected:** PO generates without logo, no errors

### Test 5: Logo File Upload
1. Upload PNG logo file
2. **Expected:** File uploads to Firebase Storage
3. **Expected:** Preview shows uploaded logo
4. **Expected:** Logo appears in app and PO

### Test 6: Invalid URL Handling
1. Enter invalid logo URL
2. Save settings
3. **Expected:** Validation error or warning
4. **Expected:** Test URL button shows error

### Test 7: Print Quality
1. Generate PO with logo
2. Print PDF to paper
3. **Expected:** Logo is clear and not pixelated
4. **Expected:** Logo maintains proper proportions

## Technical Implementation Notes

### Caching Strategy

**For Web Display:**
- Browser caches logo automatically (standard HTTP caching)
- No special handling needed for external URLs

**For PDF Generation:**
```typescript
// Option 1: Convert to Data URI
async function logoToDataURI(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = response.headers.get('content-type');
  return `data:${mimeType};base64,${base64}`;
}

// Option 2: Download to temp file
async function downloadLogoTemp(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const tempPath = `/tmp/logo_${Date.now()}.png`;
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}
```

### Fallback Handling

```typescript
function getLogoUrl(organization: Organization): string | null {
  // Priority order:
  // 1. Uploaded logo (Firebase Storage)
  // 2. External URL
  // 3. Default placeholder (optional)
  
  if (organization.companyLogo) {
    return organization.companyLogo;
  }
  
  // Optional: Return default placeholder
  return '/assets/default-logo-placeholder.png';
}
```

### Performance Optimization

1. **Lazy Loading:** Load logos only when needed
2. **Caching:** Cache downloaded logos for PDF generation
3. **Compression:** Use optimized logo files
4. **CDN:** Consider using CDN for faster loading (optional)

## Security Considerations

### URL Validation

```typescript
function isValidLogoUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Only allow HTTPS URLs
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    // Check file extension
    const validExtensions = ['.png', '.jpg', '.jpeg', '.svg'];
    const hasValidExtension = validExtensions.some(ext => 
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );
    return hasValidExtension;
  } catch {
    return false;
  }
}
```

### File Upload Security

- ✅ Validate file type (check magic numbers, not just extension)
- ✅ Scan for malware (if using third-party service)
- ✅ Limit file size (max 2MB)
- ✅ Store with restricted access (only organization members)
- ✅ Generate unique filenames to prevent overwriting

## Recommended Setup for 1PWR Africa

### Immediate Setup (Using Existing Logo)

```typescript
// In Organization Settings for 1PWR Africa
{
  id: "1pwr_africa",
  name: "1PWR Africa",
  companyLegalName: "1PWR Africa (Pty) Ltd", // Adjust as needed
  companyLogo: "https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png",
  companyLogoWidth: 200,
  companyLogoHeight: null, // auto
  // ... other fields
}
```

### Future Enhancement

1. Download logo from website
2. Upload to Firebase Storage
3. Update `companyLogo` to Firebase URL
4. Keep website URL as fallback

## Conclusion

The 1PWR Africa logo at https://1pwrafrica.com/wp-content/uploads/2018/11/logo.png is **perfect for integration** into the PR/PO system. The PNG format with transparent background will work excellently for:

✅ Web application header  
✅ Dashboard and views  
✅ Generated PO PDF documents  
✅ Professional branded materials  

**Recommendation:** Start with direct URL reference for quick implementation, then optionally migrate to Firebase Storage for better control and performance in production.

**Status:** ✅ Type definitions updated, specifications documented, ready for UI implementation





