function scrollToSection(id){
  const section = document.getElementById(id);
  const nav = document.getElementById("navbar");
  const navHeight = nav ? nav.offsetHeight : 0;

  const y = section.offsetTop - navHeight - 10;

  window.scrollTo({ top: y, behavior: "smooth" });
}

/* Reveal animation */
function revealOnScroll() {
  const reveals = document.querySelectorAll(".reveal");

  reveals.forEach((el) => {
    const windowHeight = window.innerHeight;
    const top = el.getBoundingClientRect().top;

    if (top < windowHeight - 90) {
      el.classList.add("show");
    }
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
