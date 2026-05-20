const header = document.querySelector("[data-header]");
const bookingForm = document.querySelector("[data-booking-form]");
const roomLinks = document.querySelectorAll("[data-room-link]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxClose = document.querySelector("[data-lightbox-close]");
const reviewCards = document.querySelectorAll("[data-review-card]");
const reviewDots = document.querySelectorAll("[data-review-dot]");

const whatsappNumber = "919790891558";
let activeReview = 0;

window.addEventListener("scroll", () => {
  header.classList.toggle("is-solid", window.scrollY > 80);
});

roomLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const roomSelect = bookingForm.elements.room;
    roomSelect.value = link.dataset.roomLink;
  });
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const form = new FormData(bookingForm);
  const message = [
    "Hello SPSS Residency, I would like to book a room.",
    "",
    `Name: ${form.get("name")}`,
    `Mobile: ${form.get("phone")}`,
    `Room type: ${form.get("room")}`,
    `Check-in: ${form.get("checkin")}`,
    `Nights: ${form.get("nights")}`,
    `Guests: ${form.get("guests")}`,
    `Notes: ${form.get("notes") || "None"}`,
  ].join("\n");

  window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
});

document.querySelectorAll("[data-src]").forEach((button) => {
  button.addEventListener("click", () => {
    lightboxImage.src = button.dataset.src;
    lightbox.showModal();
  });
});

lightboxClose.addEventListener("click", () => {
  lightbox.close();
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

function showReview(index) {
  activeReview = index;
  reviewCards.forEach((card, cardIndex) => {
    card.classList.toggle("is-active", cardIndex === activeReview);
  });
  reviewDots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === activeReview);
  });
}

reviewDots.forEach((dot, index) => {
  dot.addEventListener("click", () => showReview(index));
});

if (reviewCards.length > 0) {
  setInterval(() => {
    showReview((activeReview + 1) % reviewCards.length);
  }, 4200);
}
