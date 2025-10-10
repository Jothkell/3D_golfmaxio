# GolfMax Remote Fitting Landing Page

A professional landing page for GolfMax's remote golf club fitting service, designed to match the existing GolfMax branding and incorporate elements inspired by L.A.B. Golf's remote fitting page.

## Features

- **Fixed Navigation Bar** with GolfMax logo and Shop button linking to the main store
- **Scrolling Reviews Banner** showcasing 5-star customer testimonials
- **Professional Fitter Bio Section** with photo and description
- **Contact Form** with video upload capability for swing analysis
- **Google Docs-inspired styling** for form elements and content boxes
- **Responsive design** optimized for desktop, tablet, and mobile devices
- **GolfMax branding** using the existing color scheme (#f6f7f9 and black)

## File Structure

- `index.html` - Main landing page
- `styles.css` - All styling and CSS animations
- `logo.png` - GolfMax logo (downloaded from existing site)
- `fitter.jpg` - Fitter photo (placeholder - replace with actual image)

## Setup Instructions

1. **Replace the fitter image**: 
   - Replace `fitter.jpg` with the actual photo of the fitter
   - Recommended dimensions: 300x300px or similar square format
   - Supported formats: JPG, PNG, WebP

2. **Customize the bio text**:
   - Edit the fitter description in the `index.html` file
   - Update the "About the Fitter" section with specific details

3. **Update contact form**:
   - Add form handling functionality (currently static HTML)
   - Configure video upload processing
   - Add form validation as needed

4. **Deploy**:
   - Upload all files to your web server
   - Ensure all image files are properly uploaded
   - Test responsiveness on different devices

### Production checklist (quick wins)
- SEO: Open Graph + Twitter meta added to `index.html` and `landingpage_2.html`.
- Robots: `robots.txt` created with a pointer to `/sitemap.xml`.
- Sitemap: `sitemap.xml` added — replace `https://YOUR_DOMAIN` with your production origin before going live.
- 404: `404.html` added for nicer not-found handling on static hosts.
- Reviews API: Cloudflare Worker supports `ALLOWED_ORIGINS` (CORS). Set via Wrangler.

### Configure sitemap domain
Search/replace `https://YOUR_DOMAIN` in `sitemap.xml` with your final site URL (e.g., `https://remote.thegolfmax.com`).

### Bind Worker to your site (Cloudflare Pages)
- Route `/api/reviews` on your Pages project to the Worker so the frontend fetches same-origin.

## Customization

### Colors
The CSS uses CSS variables for easy color customization:
- `--primary-color`: #f6f7f9 (light blue-grey background)
- `--contrast-color`: #000000 (black for headers/text)
- `--accent-color`: #ffffff (white for content backgrounds)

### Typography
- Headers: 'Recoleta' serif font (matching existing GolfMax site)
- Body text: 'Work Sans' sans-serif font
- Form elements: 'Arial' for Google Docs-like appearance

### Responsive Breakpoints
- Desktop: Default styles
- Tablet/Mobile: 768px and below

## Browser Compatibility

Compatible with all modern browsers including:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Performance Features

- Optimized CSS animations
- Efficient image loading
- Minimal JavaScript dependencies
- Fast loading times

## Future Enhancements

Consider adding:
- Form submission handling with backend integration
- Video upload progress indicators
- Email notifications for form submissions
- Analytics tracking
- SEO optimization
- Additional testimonial content
# 3D_golfmaxio
