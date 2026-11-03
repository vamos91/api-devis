const express = require('express')
const app = express()
const port = 3000


app.use(express.json())


app.get('/', (request, response) => {
    response.json({message: 'salut'})
})

app.get('/health', (request, response) => {
    response.json({message: "check server works"})
})

app.get('/services', (request, response) => {
    response.json({message: "i display services"})
})

app.post('/', (request, response) => {
    const data = request.body
    //store data in DB
    response.json({dataToStore: data})
})


app.listen(port, () => {
    console.log('App listen on localhost:' + port)
})