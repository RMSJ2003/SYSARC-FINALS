import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

// Postgresql 
import pg from "pg";

// Reading High Protein foods from Kaggle Datasets - Start
import fs from "fs";
import csv from "csv-parser";
import { log } from "console";

import dotenv from "dotenv";
dotenv.config();

const highProteinFoods = [];

fs.createReadStream("./data/macros_dataset.csv")
    .pipe(csv())
    .on("data", (data) => highProteinFoods.push(data))
    .on("end", () => {
        console.log(highProteinFoods); // Process or use your data here
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

        // SQL to create the 'users' table if it doesn't exist
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS highProteinFoods (
	            id SERIAL PRIMARY KEY,
	            food_name VARCHAR(255) NOT NULL
            );
        `;

        const deleteContent = `DELETE FROM highProteinFoods;`;

        // Create the base query
        let populateTableQuery = `INSERT INTO highProteinFoods (food_name) VALUES `;

        const foods = [];
        for (let i = 0; i < highProteinFoods.length; i++) {
            populateTableQuery += `('${highProteinFoods[i].food_name}')`;
            
            if (i < highProteinFoods.length - 1) populateTableQuery += ", "
        }
                
        db.query(deleteContent + createTableQuery + populateTableQuery, (err) => {
            if (err) {
                console.error("Error creating users table:", err.stack);
            } else {
                console.log("Users table is ready.");
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

app.get("/", async (req, res) => {
    const result = await getFoodsFromDb();
    

    res.render("index.ejs", {
        year: d.getFullYear(),
        highProteinFoods: result
    });
});

app.post("/get-macros", async (req, res) => {
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
    res.render("index.ejs", {
        foodName: format_name(food),
        calories: result.data.foods[0].nf_calories,
        protein: result.data.foods[0].nf_protein,
        carbs: result.data.foods[0].nf_total_carbohydrate,
        fats: result.data.foods[0].nf_total_fat,
        imgURL: result.data.foods[0].photo.thumb,
        year: d.getFullYear(),
        highProteinFoods: results
    });
    console.log(result.data);
    // console.log(result.data.foods[0].nf_calories);
    // render the macros and the image
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 