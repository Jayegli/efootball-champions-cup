# EPL eFootball Champions Cup — online version

## What this project does
- Public read-only tournament page: standings, league fixtures, scores and knockout data.
- Admin sign-in for `atinyajohn001@gmail.com`.
- Admin can import the existing JSON backup, update scores and upload match screenshots.
- Supabase Row Level Security is expected to enforce write permissions; the browser UI check is not the security boundary.

## 1. Configure Supabase
The SQL setup described in the ChatGPT instructions creates:
- `public.clubs`
- `public.matches`
- `public.knockout_state`
- public `match-proofs` Storage bucket
- RLS policies allowing public reads and only the specified email to write.

Before deploying, verify that these tables and policies exist in Supabase. Do not put a secret/service_role key in this project.

## 2. Add the browser connection settings
Open `config.js` and replace:
- `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE`
- `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE`

Use the Project URL and Publishable Key copied from your Supabase project. These are intended for browser use when RLS is correctly configured.

## 3. Deploy to Netlify
- Sign in to Netlify.
- Go to `https://app.netlify.com/drop`.
- Drag the unzipped project folder (the folder containing `index.html`) onto the drop area.
- Netlify will publish it and provide a public `*.netlify.app` URL.

## 4. Import the original tournament backup
- Open the deployed website.
- Click **Admin login**.
- Sign in as `atinyajohn001@gmail.com`.
- Open **Import original tournament backup** and choose the original JSON backup file.
- Wait for the import confirmation. Keep the original backup unchanged as a safety copy.

The importer maps the original club array positions to club IDs 0–19, imports the 80 fixtures and scores, uploads embedded image proofs to Supabase Storage, and imports knockout data.

## 5. Test permissions
- In a private/incognito browser window, open the public Netlify URL. Confirm it can display the data but offers no editing controls unless an authorised admin signs in.
- Sign in with the administrator account and test updating one result.
- Confirm the updated result appears on the public page.
- Never share a Supabase secret key or database password.

## Notes
- The public `match-proofs` bucket means uploaded match screenshots can be viewed by anyone with the public page or direct image URL. Do not upload private or sensitive images.
- This is a first deployment starter. Confirm the data import and permissions before sharing the link widely.
