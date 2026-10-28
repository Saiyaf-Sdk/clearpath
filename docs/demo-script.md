# 5-Minute Demonstration Script – EC4307 Mini Project

Use this script as a personal guide while recording your video demonstration.

> **Rules from the Rubric:**
> - Maximum duration: **5 minutes** (Strict penalty if exceeded!).
> - Camera **MUST be turned ON** showing your face while speaking/presenting.
> - Video filename: `<index_number>_video.mp4` (or as required by course submission).

---

### Preparation
1. Open the terminal and in `server/`, run `npm run seed` to ensure clean demo data.
2. Default password for all demo accounts: `password123`.
3. Open your browser to the local URL (or Render deployment URL).
4. Have your webcam recording software (OBS, Zoom, Loom, or camera app) ready with camera overlay active.

---

### Step-by-Step Timed Walkthrough

| Time | Action & What to Show | Rubric Criterion Covered |
| :--- | :--- | :--- |
| **0:00–0:25** | • **Camera on face**: State your name, index number, and project title (**ClearPath**).<br>• Explain the problem (manual, paper-based university clearance across multiple offices) and solution using the MERN stack. | Project Overview & Presentation |
| **0:25–1:00** | • Go to Home → **Log in** → **University of Ruhuna** → **Faculty of Engineering**.<br>• Log in as student `demo.tharindu@ruh.ac.lk`.<br>• Submit a new clearance request (**Create**).<br>• Show that it splits across department offices and central offices.<br>• Click **Edit request** to change the note (**Update**). | **Create** (4 marks)<br>**Update** (4 marks) |
| **1:00–2:00** | • Log in as officer `demo.eng.flib@ruh.ac.lk` (Engineering Faculty Library).<br>• Go to **Clearance requests**: demonstrate **search**, **filter**, **sort**, and click to open the slide-out details drawer (**Read**).<br>• Go to **Dues register**: add a due for `EG/2021/4510` (show live student lookup).<br>• Enter amount `0` to demonstrate validation error handling.<br>• Edit the due amount.<br>• Safely **delete** the due with the confirmation dialog. | **Read** (4 marks)<br>**Validation & Error Handling** (2 marks)<br>**Delete** (4 marks) |
| **2:00–2:45** | • Log in as student `demo.kasun@ruh.ac.lk`.<br>• Go to **Dues & payments** → upload an image as a receipt for the LKR 450 fine.<br>• Switch back to faculty librarian → **Receipts to verify** → approve receipt → Kasun returns to Pending queue → click **Clear**. | Workflow & Business Logic |
| **2:45–3:40** | • Go to **Central administration** portal → log in as `demo.admin@ruh.ac.lk`.<br>• Show **Faculties** page (10 faculties, each with its own admin and isolated portal).<br>• Go to **Official student list**: add a student, edit details, delete student, and sort table.<br>• Go to **Offices**: show that trying to delete a vital central office (e.g. Main Library) is safely refused.<br>• Show **Reports** with faculty filter, and **Audit log**. | **Database Integrity & Full Admin CRUD** |
| **3:40–4:15** | • Log in as `demo.nimali@ruh.ac.lk` → **Certificate** → download PDF certificate → show generated QR code.<br>• Open public certificate verification page (`/verify/<certNo>`).<br>• Demonstrate **Multi-tenancy & Security**: try logging Kasun into the **Science** portal (refused with redirect link); try logging him into the **Colombo** portal (refused, different university). | **Security & Multi-Tenancy** |
| **4:15–4:40** | • Open browser Developer Tools → toggle **Mobile Device toolbar** to show responsive design and drawer navigation.<br>• Toggle **Dark Mode** switch in the top bar. | **UI/UX & Responsiveness** (2 marks) |
| **4:40–5:00** | • Switch to GitHub repository: show clean commit history, README with ERD diagram, and documentation. Wrap up with concluding remarks. | **Code Quality & Documentation** (2 marks) |

