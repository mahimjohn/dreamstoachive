/* ===========================
   ✅ Read company & role
   =========================== */
const params = new URLSearchParams(window.location.search);
const company = (params.get("company") || "google").toLowerCase();
const role = (params.get("role") || "sde").toLowerCase();

/* ===========================
   ✅ Company Logo Mapping
   (make sure Logo/ names match)
   =========================== */
const companyLogoMap = {
  google: "Logo/google.webp",
  microsoft: "Logo/microsoft.png",
  amazon: "Logo/amazon.jpg",
  adobe: "Logo/adobe.png",
  infosys: "Logo/infosys.png",
  tcs: "Logo/tcs.jpeg",
  wipro: "Logo/wipro.png",
  "l&t": "Logo/l&t.jpg",
  lnt: "Logo/l&t.jpg",
  capgemini: "Logo/capgemini.png",
  cognizant: "Logo/cognizant.png",
  hcl: "Logo/hcl.png",
  accenture: "Logo/accenture.jpg",
  flipkart: "Logo/flipkart.jpg",
  "tech mahindra": "Logo/tech mahinder.png",
  service: "Logo/infosys.png"
};

/* ===========================
   ✅ Roadmap Database
   =========================== */
const DB = {
  common: {
    certs: [
      "Git & GitHub Foundations",
      "CS50 (Harvard) / NPTEL Programming",
      "LinkedIn Learning: Resume & Interview"
    ],
    prep: [
      "Resume + LinkedIn polishing",
      "Mock interviews weekly",
      "Aptitude + Communication practice"
    ]
  },

  roles: {
    sde: {
      years: [
        ["C/Python basics", "Problem solving basics", "Git + GitHub", "HTML/CSS basics"],
        ["OOP (Java/C++)", "DBMS + SQL", "OS basics", "2 mini projects"],
        ["DSA advanced", "System Design intro", "Internship prep", "LeetCode 250+"],
        ["System Design advanced", "Mock interviews", "Apply + referrals", "1 standout project"]
      ],
      certs: ["Google Cloud Digital Leader / AWS CCP / Azure Fundamentals"],
      projects: ["Portfolio site", "DSA Tracker", "Mini LinkedIn Clone"],
      prep: ["DSA patterns", "System design fundamentals", "HR + behavioral practice"]
    },

    fullstack: {
      years: [
        ["HTML/CSS/JS", "Git + GitHub", "React basics", "Build 2 UI clones"],
        ["Node.js concepts", "MongoDB/SQL", "Auth + APIs", "Full stack mini apps"],
        ["Advanced React", "System Design basics", "Deployment + CI/CD", "Internship + Open Source"],
        ["Scale projects", "Mock interviews", "DSA revision", "Apply + referrals"]
      ],
      certs: ["Meta Front-End / Full Stack", "MongoDB University Basics"],
      projects: ["Full Stack Blog", "E-Commerce Website", "College Portal App"],
      prep: ["React interview Qs", "Backend API Qs", "DSA medium level"]
    },

    frontend: {
      years: [
        ["HTML/CSS basics", "Figma basics", "JS fundamentals", "Clone 3 websites"],
        ["React", "Responsive design", "Animations", "Portfolio website"],
        ["Next concepts (optional)", "Performance optimization", "Open source", "Internship prep"],
        ["Top portfolio", "Mock interviews", "DSA basics", "Apply + referrals"]
      ],
      certs: ["Meta Front-End", "Google UX Basics"],
      projects: ["Landing pages", "Portfolio", "UI library components"],
      prep: ["Frontend interview Qs", "JS interview Qs", "CSS layouts"]
    },

    backend: {
      years: [
        ["Programming basics", "Git", "HTTP basics", "Basic APIs"],
        ["DBMS", "Node/Java backend", "Auth + REST", "Mini backend projects"],
        ["System Design intro", "Caching", "Queues", "Internship prep"],
        ["System design advanced", "Mock interviews", "DSA revision", "Apply"]
      ],
      certs: ["SQL Certification", "Backend API course"],
      projects: ["Auth API", "Task manager backend", "URL shortener"],
      prep: ["DBMS/OS/CN revision", "System design practice", "DSA patterns"]
    },

    android: {
      years: [
        ["Java/Kotlin basics", "Android UI", "Git", "Build 2 apps"],
        ["API integration", "Firebase", "MVVM", "Play store deployment"],
        ["Advanced features", "Architecture", "Internships", "Hackathons"],
        ["Mock interviews", "DSA basics", "System design intro", "Apply"]
      ],
      certs: ["Android Developer basics", "Firebase basics"],
      projects: ["Notes App", "Expense Tracker", "College App"],
      prep: ["Android interview Qs", "Projects strong", "DSA revision"]
    },

    devops: {
      years: [
        ["Linux basics", "Git", "Networking basics", "Shell scripting"],
        ["Docker", "Kubernetes basics", "CI/CD", "Deploy small projects"],
        ["Cloud basics AWS/Azure", "Terraform intro", "Monitoring tools"],
        ["Advanced DevOps", "System design infra", "Apply", "Real infra project"]
      ],
      certs: ["AWS CCP / Azure Fundamentals", "Docker + Kubernetes Course"],
      projects: ["CI/CD pipeline project", "Deploy app with Docker", "K8s deployment"],
      prep: ["Linux + networking", "Cloud Qs", "DevOps interviews"]
    },

    cyber: {
      years: [
        ["Networking", "Linux basics", "C basics", "Cyber fundamentals"],
        ["Web security basics", "OWASP Top 10", "CTF practice"],
        ["Pentesting tools", "Internships", "Bug bounty basics"],
        ["Mock interviews", "Certifications", "Apply + build portfolio"]
      ],
      certs: ["CEH basics / TryHackMe", "Google Cybersecurity Certificate"],
      projects: ["Security audit report", "CTF writeups", "OWASP demo project"],
      prep: ["Networking Qs", "Security concepts", "Mock security interviews"]
    },

    data_analyst: {
      years: [
        ["Excel", "SQL basics", "Python basics", "Statistics intro"],
        ["Power BI / Tableau", "EDA projects", "SQL advanced", "Kaggle basics"],
        ["Internship prep", "Dashboard portfolio", "Case studies"],
        ["Mock interviews", "Business analytics", "Apply + referrals"]
      ],
      certs: ["Google Data Analytics", "Power BI Certification"],
      projects: ["Sales dashboard", "Netflix analysis", "College data report"],
      prep: ["SQL interview Qs", "Case studies", "Statistics revision"]
    },

    data_engineer: {
      years: [
        ["Python basics", "SQL", "Linux basics", "Data basics"],
        ["ETL pipelines", "DB design", "Airflow intro", "Mini pipelines"],
        ["Big data basics", "Spark intro", "Cloud data services", "Internship"],
        ["System design data", "Mock interviews", "Apply", "Capstone pipeline"]
      ],
      certs: ["Google Cloud Data Engineer basics", "Databricks / Spark"],
      projects: ["ETL pipeline", "Airflow DAG project", "Spark analytics project"],
      prep: ["SQL + ETL", "Pipeline design", "System design data"]
    },

    data_scientist: {
      years: [
        ["Python", "Statistics", "Linear algebra basics", "EDA projects"],
        ["ML basics", "Model evaluation", "Kaggle competitions"],
        ["Advanced ML", "Deep learning intro", "Internship + research"],
        ["Mock interviews", "Portfolio", "Deploy ML projects", "Apply"]
      ],
      certs: ["IBM Data Science", "Coursera ML Andrew Ng"],
      projects: ["ML classification", "Recommendation system", "NLP mini project"],
      prep: ["ML interview Qs", "Stats questions", "Case studies"]
    },

    aiml: {
      years: [
        ["Python + math basics", "EDA", "Basic ML", "Projects"],
        ["ML models", "Feature engineering", "Model tuning", "Kaggle"],
        ["Deep Learning", "NLP/CV basics", "Internship prep", "Research papers"],
        ["Deploy ML apps", "Mock interviews", "Apply + portfolio", "Capstone"]
      ],
      certs: ["DeepLearning.AI", "Google ML Crash Course"],
      projects: ["Spam classifier", "Image classifier", "Chatbot project"],
      prep: ["ML theory", "Projects explanation", "Case studies"]
    },

    pm: {
      years: [
        ["Communication", "Product basics", "Excel", "Basic tech awareness"],
        ["Case studies", "Product thinking", "Market research", "Mini product docs"],
        ["Internships", "Metrics + growth", "Product design basics"],
        ["Mock interviews", "PM case rounds", "Apply + referrals"]
      ],
      certs: ["Google Project Management", "Product Management Basics"],
      projects: ["Product requirement doc", "Competitor analysis", "Mock product launch"],
      prep: ["Case studies", "Metrics questions", "Behavioral rounds"]
    },

    uiux: {
      years: [
        ["Figma basics", "UI principles", "Design systems", "2 redesigns"],
        ["UX research", "Wireframes", "Prototypes", "Portfolio"],
        ["Internships", "Advanced UX", "Accessibility", "Real client work"],
        ["Mock interviews", "Portfolio polish", "Apply"]
      ],
      certs: ["Google UX Design", "Figma course"],
      projects: ["App redesign", "Dashboard UX", "Case study portfolio"],
      prep: ["Design interviews", "Case study presentation", "Portfolio review"]
    },

    qa: {
      years: [
        ["Testing basics", "Manual testing", "Bug reporting", "Git basics"],
        ["Automation intro", "Selenium basics", "API testing basics"],
        ["Framework design", "CI/CD tests", "Internship prep"],
        ["Mock interviews", "Automation projects", "Apply"]
      ],
      certs: ["Software Testing Basics", "Selenium automation course"],
      projects: ["Automation framework", "API test suite", "Bug tracker report"],
      prep: ["Testing theory", "Automation Qs", "SQL basics"]
    }
  }
};

/* ===========================
   ✅ Company overrides (optional)
   =========================== */
const companyExtras = {
  google: { addPrep: ["System design focus", "High DSA frequency", "Googleyness behavioral prep"] },
  amazon: { addPrep: ["Leadership Principles stories", "LP mock interviews"] },
  microsoft: { addPrep: ["CS core strong: OS/DBMS/CN", "Projects + resume clarity"] },
  service: { addPrep: ["Aptitude daily", "Company test patterns", "HR Qs intense"] }
};


/* ===========================
   ✅ Helpers
   =========================== */
const titleEl = document.getElementById("title");
const metaCompany = document.getElementById("metaCompany");
const metaRole = document.getElementById("metaRole");
const companyNameEl = document.getElementById("companyName");
const companyLogoEl = document.getElementById("companyLogo");

const yearTitleEl = document.getElementById("yearTitle");
const yearChipEl = document.getElementById("yearChip");
const yearListEl = document.getElementById("yearList");

const certListEl = document.getElementById("certList");
const projListEl = document.getElementById("projList");
const prepListEl = document.getElementById("prepList");

const roadmapArea = document.getElementById("roadmapArea");
const downloadBtn = document.getElementById("downloadBtn");

const roleNameMap = {
  sde: "SDE",
  fullstack: "Full Stack Developer",
  frontend: "Frontend Developer",
  backend: "Backend Developer",
  android: "Android Developer",
  devops: "DevOps Engineer",
  cyber: "Cybersecurity Engineer",
  data_analyst: "Data Analyst",
  data_engineer: "Data Engineer",
  data_scientist: "Data Scientist",
  aiml: "AI / ML Engineer",
  pm: "Product Manager",
  uiux: "UI/UX Designer",
  qa: "QA / Test Engineer"
};

function prettyCompany(c){
  if(c === "lnt") return "L&T";
  if(c === "service") return "Service Based";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function fillList(el, items){
  el.innerHTML = items.map(x => `<li>${x}</li>`).join("");
}

/* ===========================
   ✅ Select roadmap data
   =========================== */
const selectedRole = DB.roles[role] || DB.roles.sde;
const companyAdd = companyExtras[company]?.addPrep || [];

const selected = {
  years: selectedRole.years,
  certs: [...(selectedRole.certs || []), ...DB.common.certs],
  projects: selectedRole.projects || [],
  prep: [...(selectedRole.prep || []), ...DB.common.prep, ...companyAdd]
};

/* ===========================
   ✅ Fill header + logo
   =========================== */
const companyPretty = prettyCompany(company);
const rolePretty = roleNameMap[role] || role.toUpperCase();

titleEl.innerHTML = `Roadmap for <span class="gradient">${companyPretty}</span> — ${rolePretty}`;
metaCompany.textContent = "Company: " + companyPretty;
metaRole.textContent = "Role: " + rolePretty;

companyNameEl.textContent = companyPretty;
companyLogoEl.src = companyLogoMap[company] || "Logo/google.webp";

/* ===========================
   ✅ Tabs (Year switching)
   =========================== */
const tabs = document.querySelectorAll(".tab");
const yearPanel = document.querySelector(".year-panel");

function yearChipLabel(i){
  if(i === 0) return "Foundation";
  if(i === 1) return "Core Skills";
  if(i === 2) return "Internship Focus";
  return "Final Push";
}

function renderYear(index){
  yearPanel.classList.add("fade");

  setTimeout(() => {
    yearTitleEl.textContent = `Year ${index + 1}`;
    yearChipEl.textContent = yearChipLabel(index);

    const items = selected.years[index] || [];
    yearListEl.innerHTML = items.map(x => `<li>${x}</li>`).join("");

    yearPanel.classList.remove("fade");
  }, 140);
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const yearIndex = Number(tab.dataset.year);
    renderYear(yearIndex);
  });
});

/* Initial year */
renderYear(0);

/* Fill extra sections */
fillList(certListEl, selected.certs);
fillList(projListEl, selected.projects);
fillList(prepListEl, selected.prep);

/* ===========================
   ✅ Reveal animation
   =========================== */
function revealOnScroll() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((el) => {
    const top = el.getBoundingClientRect().top;
    if (top < window.innerHeight - 90) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

/* ===========================
   ✅ REAL PDF Download
   Uses html2canvas + jsPDF
   =========================== */
downloadBtn.addEventListener("click", async () => {
  downloadBtn.textContent = "Generating...";
  downloadBtn.disabled = true;

  const { jsPDF } = window.jspdf;

  try {
    // render screenshot
    const canvas = await html2canvas(roadmapArea, {
      scale: 2,
      useCORS: true
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`DreamsToAchive_${companyPretty}_${rolePretty}_Roadmap.pdf`);
  } catch (err) {
    alert("PDF generation failed 😢 Try again or use Print option.");
    console.log(err);
  }

  downloadBtn.textContent = "Download PDF";
  downloadBtn.disabled = false;
});
/* ===========================
   ✅ End of File
   =========================== */