const express = require('express');
const app = express()

app.use(express.static('public'))

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');


app.get('/', (req, res)=>{
    console.log('get /')
    app.render('index')
})

app.listen(3001)
