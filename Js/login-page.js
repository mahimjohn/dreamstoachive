// Firebase Imports

import { auth, db } from "./firebase-config.js";

import {

    signInWithEmailAndPassword

} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";


import {

    doc,
    getDoc

} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";



// HTML Elements

const email = document.getElementById("email");

const password = document.getElementById("password");

const loginBtn = document.getElementById("login-btn");




// Login Button

loginBtn.addEventListener("click", async () => {

    const userEmail = email.value.trim();

    const userPassword = password.value.trim();


    // Validation

    if (!userEmail || !userPassword) {

        alert("Please enter your email and password.");

        return;

    }


    try {

        // Authenticate User

        const userCredential = await signInWithEmailAndPassword(

            auth,
            userEmail,
            userPassword

        );


        const user = userCredential.user;

        const uid = user.uid;


        // Fetch User Details From Firestore

        const userRef = doc(db, "users", uid);

        const userSnap = await getDoc(userRef);



        if (!userSnap.exists()) {

            alert("User data not found.");

            return;

        }



        const userData = userSnap.data();


        // Check Role

        const role = userData.Role;


        // Redirect According To Role


        if (role === "Admin") {

            window.location.href = "../pages/dashboard.html";

        }


        else if (role === "Principal") {

            window.location.href = "../pages/principal-dashboard.html";

        }


        else if (role === "Teacher") {

            window.location.href = "../pages/teacher-dashboard.html";

        }


        else if (role === "Finance") {

            window.location.href = "../pages/fees-dashboard.html";

        }


        else if (role === "Admission") {

            window.location.href = "../pages/admission-dashboard.html";

        }


        else {

            alert("Invalid User Role.");

        }


    }


    catch (error) {

        alert(error.message);

        console.log(error);

    }


});
