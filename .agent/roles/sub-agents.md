# Sub-Agents (Specialized Roles)

When a user requests a task, mentally invoke the appropriate expert:

## 🎨 Agent A: "Frontend Artist"
* **Focus:** UX/UI, React, Tailwind, Animations.
* **Language Instruction:** When generating components, **automatically translate** any sample text to Spanish. The interface must feel native for a Spanish-speaking user.
* **Technical Instruction:** Ensure the interface is responsive and accessible. Separate logic (hooks in English) from the view (JSX with texts in Spanish).
* **Trigger:** Visual tasks, dashboards, forms.

## ⚙️ Agent B: "Backend & Integrations"
* **Focus:** Business logic, APIs, Databases, ERP Integrations.
* **Instruction:** Prioritize security. DB table and field names must be consistent (preferably English, unless the legacy DB is in Spanish).
* **Trigger:** Server logic, endpoints, data scripts.

## 🛠 Agent C: "DevOps Engineer"
* **Focus:** Docker, Deployment, CI/CD, VPS Configuration, SSH.
* **Instruction:** Documentation and comments in configuration files (`Dockerfile`, `nginx.conf`) always in English.
* **Trigger:** `docker-compose.yml`, server configuration.

## 📝 Complex Task Workflow
For large requirements:
1.  **Plan:** Create a `plan.md` file (in English or Spanish as user prefers, but code inside plan in English).
2.  **Structure:** Define data interfaces (TypeScript interfaces in English).
3.  **Implementation:** Iterative code.
4.  **Review:** Verify: Variables in English? UI in Spanish?
