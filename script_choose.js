/* Reveal animation */
function revealOnScroll() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((el) => {
    const windowHeight = window.innerHeight;
    const top = el.getBoundingClientRect().top;
    if (top < windowHeight - 90) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealOnScroll);
window.addEventListener("load", revealOnScroll);

/* Mobile menu */
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");

if (hamburger && mobileMenu){
  hamburger.addEventListener("click", () => {
    mobileMenu.style.display = (mobileMenu.style.display === "block") ? "none" : "block";
  });

  window.addEventListener("click", (e) => {
    if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
      mobileMenu.style.display = "none";
    }
  });
}

function closeMenu(){
  if (mobileMenu) mobileMenu.style.display = "none";
}

/* Company selection */
function selectCompany(company){
  const companyMap = {
    google: "Google",
    microsoft: "Microsoft",
    amazon: "Amazon",
    adobe: "Adobe",
    flipkart: "Flipkart",
    tcs: "TCS",
    infosys: "Infosys",
    wipro: "Wipro",
    accenture: "Accenture",
    cognizant: "Cognizant",
    capgemini: "Capgemini",
    hcl: "HCL",
    techm: "Tech Mahindra",
    lt: "L&T (LTI Mindtree)"
  };

  const input = document.getElementById("company");

  if (input) input.value = companyMap[company] || company;
  if (input) input.setAttribute("data-value", company);

  const buttons = document.querySelectorAll(".company-btn");
  buttons.forEach(btn => btn.classList.remove("active"));

  const active = document.querySelector(`.company-btn[data-company="${company}"]`);
  if (active) active.classList.add("active");
}

/* Generate roadmap */
function generateRoadmap(){
  const companyInput = document.getElementById("company");
  const company = companyInput.getAttribute("data-value") || companyInput.value;
  const role = document.getElementById("role").value;

  window.location.href = `roadmap.html?company=${company}&role=${role}`;
}

/* Default */
window.addEventListener("load", () => {
  selectCompany("google");
});
