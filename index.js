import express from "express";
import session from "express-session";
import axios from "axios";
import bodyParser from "body-parser";

// Postgresql 
import pg from "pg";

// Reading High Protein foods from Kaggle Datasets - Start
import fs from "fs";
import csv from "csv-parser";

import dotenv from "dotenv";
dotenv.config();

const highProteinFoods = [];

fs.createReadStream("./data/macros_dataset.csv")
    .pipe(csv())
    .on("data", (data) => highProteinFoods.push(data))
    .on("end", () => {
        // Process or use your data here
    });
// Reading High Protein foods from Kaggle Datasets - End

const app = express();
const port = 3000;
const API_URL = "https://trackapi.nutritionix.com/v2/natural";
const x_app_key = "4fb5c674c6427f117f2eb56730786497";
const x_app_id = "f8b6f9d5";
const config = {
    headers: {
        "x-app-key": x_app_key,
        "x-app-id": x_app_id
    }
}
const d = new Date();
var fullYear = d.getFullYear();

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "SYSARC Finals",
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});
db.connect((err) => {
    if (err) {
        console.error("Failed to connect to the database:", err.stack);
    } else {
        console.log("Connected to the database.");
        // Check if the table exists before deleting
        const checkTableExistsQuery = `
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables 
    WHERE table_schema = 'public'  -- or your specific schema
    AND table_name = 'highProteinFoods'
);
`;

        db.query(checkTableExistsQuery, (err, result) => {
            if (err) {  
                console.error("Error checking if table exists:", err.stack);
            } else {
                const tableExists = result.rows[0].exists;

                if (tableExists) {
                    const deleteTableQuery = "DELETE FROM highProteinFoods;";
                    db.query(deleteTableQuery, (err) => {
                        if (err) {
                            console.error("Error deleting content of highProteinFoods table:", err.stack);
                        } else {
                            console.log("highProteinFoods content has been deleted.");
                        }
                    });
                } else {
                    console.log("highProteinFoods table does not exist.");
                }
            }
        });


        // SQL to create the 'users' table if it doesn't exist
        const createTablesQuery = `
            CREATE TABLE IF NOT EXISTS highProteinFoods (
	            id SERIAL PRIMARY KEY,
	            food_name VARCHAR(255) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
	            id SERIAL PRIMARY KEY,
	            username VARCHAR(50) NOT NULL UNIQUE,
	            password VARCHAR(255) NOT NULL,
                age SMALLINT CHECK (age > 0 AND age <= 150) NOT NULL,
	            weightInLbs SMALLINT CHECK (weightInLbs > 0 AND weightInLbs <= 1000) NOT NULL,
	            heightInCm SMALLINT CHECK (heightInCm > 0 AND heightInCm <= 300) NOT NULL,
	            calories SMALLINT NOT NULL,
	            proteinPercentage SMALLINT CHECK (proteinPercentage > 0 AND proteinPercentage <= 100) NOT NULL,
	            fatsPercentage SMALLINT CHECK (fatsPercentage > 0 AND fatsPercentage <= 100) NOT NULL,
	            carbsPercentage SMALLINT CHECK (carbsPercentage > 0 AND carbsPercentage <= 100) NOT NULL
            );
        `;


        // Create the base query
        let populateTableQuery = `INSERT INTO highProteinFoods (food_name) VALUES `;

        const foods = [];
        for (let i = 0; i < highProteinFoods.length; i++) {
            populateTableQuery += `('${highProteinFoods[i].food_name}')`;

            if (i < highProteinFoods.length - 1) populateTableQuery += ", "
        }

        db.query(createTablesQuery, (err) => {
            if (err) {
                console.error("Error creating users and/or highProteinFoods tables:", err.stack);
            } else {
                console.log("users and highProteinFoods table is ready.");
            }
        });

        db.query(populateTableQuery, (err) => {
            if (err) {
                console.error("Error inserting foods in the highProteinFoods table:", err.stack);
            } else {
                console.log("highProteinFoods' data have been inserted.");
            }
        });
    }
});

function format_name(name) {
    return name.slice(0, 1).toUpperCase() + name.slice(1, name.length).toLowerCase()
}

async function getFoodsFromDb() {
    return (await db.query("SELECT * FROM highProteinFoods;")).rows;
}

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));
app.use(session({
    secret: process.env.SESSION_KEY, // change this to a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true if using HTTPS
}));

app.use((req, res, next) => {
    req.session.formError;
    req.session.searchResult;

    next();
});


app.get("/", async (req, res) => {
    const result = await getFoodsFromDb();

    const searchResultToDisplay = req.session.searchResult;
    req.session.searchResult = undefined

    const errorToDisplay = req.session.formError;
    req.session.formError = undefined;

    res.render("index.ejs", {
        year: d.getFullYear(),
        highProteinFoods: result,
        searchResult: searchResultToDisplay,
        error: errorToDisplay
    });
});

app.post("/get-macros", async (req, res) => {

    try {
        // Get the values from the form to send to Nutritionix API
        const food = req.body.food;
        const variety = req.body.variety;
        const servingSize = req.body.servingSize;
        const querytoSend = `${variety} ${food} ${servingSize}`;
        const body = {
            query: querytoSend
        };

        // Request macros data from Nutritionix API
        const result = await axios.post(`${API_URL}/nutrients`, body, config);

        // Add the formatted food name and the result data to the session
        req.session.searchResult = {
            foodName: format_name(food),
            macros: result.data.foods[0] // Add other relevant fields here if needed
        };



        // Redirect to the homepage to display results
        res.redirect("/");
        // res.render("index.ejs", {
        //     foodName: format_name(food),
        //     calories: result.data.foods[0].nf_calories,
        //     protein: result.data.foods[0].nf_protein,
        //     carbs: result.data.foods[0].nf_total_carbohydrate,
        //     fats: result.data.foods[0].nf_total_fat,
        //     imgURL: result.data.foods[0].photo.thumb,
        //     year: d.getFullYear(),
        //     highProteinFoods: highProteinFoods
        // });
    } catch (error) {
        req.session.formError = "Invalid Input";
        res.redirect("/");
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 