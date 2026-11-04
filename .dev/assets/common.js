"use strict";

const currentYear = document.getElementById("cyear");

if (currentYear) {
    currentYear.textContent = `${new Date().getFullYear()} `;
}
