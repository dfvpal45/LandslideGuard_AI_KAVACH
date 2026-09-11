/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#10222d",
                navy: "#173847",
                teal: "#087f78",
                signal: "#e8863a",
                paper: "#f5f7f4",
                mist: "#e7eeea"
            },
            fontFamily: {
                sans: ["Public Sans", "Arial", "sans-serif"],
                display: ["Barlow Condensed", "Arial Narrow", "sans-serif"]
            },
            boxShadow: {
                panel: "0 10px 30px rgba(16, 34, 45, .07)"
            }
        }
    },
    plugins: []
};
