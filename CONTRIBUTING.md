# **Contributing to Midnight Simplified Tutorial dApps**

Thank you for your interest in contributing!
This repository hosts beginner-friendly and educational dApps built for the **Midnight Simplified YouTube Series**.
All contributions—small or large—are welcome as long as they help improve the learning experience for new Midnight developers.

---

## **📌 Before You Begin**

Please make sure you:

* Understand the purpose of this repo:
  **simple, easy-to-follow Compact dApps focused on teaching.**
* Keep contributions beginner-friendly
* Follow the structure and coding style used in existing examples
* Aim for clarity over complexity

---

# **🚀 How to Contribute**

## **1. Fork the Repository**

Click the **Fork** button in GitHub and clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/midnight-simplified-tutorial-dapps.git
cd midnight-simplified-tutorial-dapps
```

---

## **2. Create a New Branch**

Name your branch based on what you’re adding:

```bash
git checkout -b add-new-dapp
# or
git checkout -b fix-readme-typo
```

---

## **3. Follow the Project Structure**

Each project must be in its own folder:

```
project-name/
│── contract/
│── helpers/   (optional)
│── ui/        (optional)
│── README.md  (required)
```

Minimum required files:

### **✔ contract/index.compact**

Your main smart contract.

### **✔ README.md**

Must include:

* Project summary
* What it teaches
* Features
* How to deploy
* How to interact

### **✔ Simplicity Rule**

Projects must be:

* Easy to understand
* Minimal in scope
* Focused on one learning concept

---

## **4. Writing a New Tutorial dApp**

When creating a new dApp, ensure:

* It introduces *one* main Midnight concept
* The code is well-commented and easy to follow
* You avoid advanced patterns unless needed
* You write using the latest Compact version
* You respect privacy principles where relevant

Examples of good tutorial dApps:

* Anonymous Poll
* Simple Escrow
* Private To-Do List
* Merkle-proof based upvote system

Examples to avoid:

* Extremely large protocols
* Multi-contract architectures
* High complexity financial systems

---

## **5. Commit Your Changes**

Use clear and descriptive commit messages:

```bash
git commit -m "Add anonymous voting dApp example"
```

---

## **6. Push and Submit a Pull Request**

```bash
git push origin add-new-dapp
```

Then open a **Pull Request (PR)** on GitHub with:

* A clear description of what you added
* A short explanation of why it fits the repo

---

# **📘 Guidelines for Pull Requests**

Your PR **will be reviewed** based on:

### ✔ Clarity

Does the code and README help beginners understand the concept?

### ✔ Simplicity

Does it fit the educational/tutorial purpose of the repo?

### ✔ Folder structure

Is everything organized correctly?

### ✔ Compact best practices

Are witness functions, ledgers, assertions, and circuits used appropriately?

### ✔ No sensitive data

Never commit real keys, wallet seeds, or private credentials.

---

# **🛠 Issues & Suggestions**

If you:

* Find a bug
* Want to request a new tutorial
* Want to propose improvements

Feel free to open an **Issue** using the GitHub “Issues” tab.

---

# **📜 Code of Conduct**

Be respectful, constructive, and patient.
The goal is to help new developers learn—keep the community welcoming.

---

# **🎉 Thank You!**

Your contribution helps more people learn the Midnight blockchain and the Compact smart contract language.
Every improvement you make supports the broader developer ecosystem.

Happy building! 🚀

---

If you'd like, I can also generate:

* A CODE_OF_CONDUCT.md
* A pull request template
* An issue template
  Just let me know.
