import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

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

function format_name(name){
    return name.slice(0,1).toUpperCase() + name.slice(1,name.length).toLowerCase()
}

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

app.get("/", async (req, res) => {
    res.render("index.ejs", { year: d.getFullYear() });
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
        year: d.getFullYear()
    });
    console.log(result.data);
    // console.log(result.data.foods[0].nf_calories);
    // render the macros and the image
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 