const express = require('express');
const app = express()
const MAPBOX_KEY = process.env.MAPBOX_KEY;

app.use(express.static('public'))

require('dotenv').config();

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

app.get('/', (req, res)=>{
    console.log('get /')
    res.render("index", {
        MAPBOX_KEY: process.env.MAPBOX_KEY
    });
})

app.get("/building", (req, res) => {
    res.render("building");
});

app.listen(process.env.PORT)
