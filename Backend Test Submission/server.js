require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')

const app = express()
const router = express.Router()

app.use(express.json())

function Log(stack, level, package, message) {
    const data = {
        stack: stack.toLowerCase(),
        level: level.toLowerCase(),
        package: package.toLowerCase(),
        message: message
    }

    fetch(process.env.LOG_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (response.ok) {
            return response.json()
        }
        throw new Error(`HTTP ${response.status}`)
    })
    .then(result => {
        console.log('Log sent successfully:', result.message)
    })
    .catch(error => {
        console.error('Log failed:', error.message)
    })
}

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    Log('backend', 'info', 'db', 'MongoDB connected successfully')
    console.log("DB Connected")
})
.catch(err => {
    Log('backend', 'fatal', 'db', 'MongoDB connection failed')
})

const urlSchema = new mongoose.Schema({
    url: String,
    shortcode: String,
    validity: Number,
    createdAt: { type: Date, default: Date.now },
    clicks: { type: Number, default: 0 },
    clickData: [{
        timestamp: Date,
        source: String
    }]
})

const Url = mongoose.model('Url', urlSchema)

function generateShortcode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

function isValidUrl(string) {
    try {
        new URL(string)
        return true
    } catch (_) {
        return false
    }
}

router.get('/', (req, res)=>{
    res.json({message: "HTTP URL Shortner Microservice Working Fine"})
})

router.post('/shorturls', async (req, res) => {
    try {
        Log('backend', 'info', 'controller', 'Create short URL request received')
        
        const { url, validity = 30, shortcode } = req.body

        if (!url) {
            Log('backend', 'warn', 'controller', 'URL field missing in request')
            return res.status(400).json({ error: 'URL is required' })
        }

        if (!isValidUrl(url)) {
            Log('backend', 'warn', 'controller', 'Invalid URL format provided')
            return res.status(400).json({ error: 'Invalid URL format' })
        }

        let finalShortcode = shortcode
        if (shortcode) {
            const existing = await Url.findOne({ shortcode })
            if (existing) {
                Log('backend', 'warn', 'controller', 'Shortcode already exists')
                return res.status(400).json({ error: 'Shortcode already exists' })
            }
        } else {
            do {
                finalShortcode = generateShortcode()
            } while (await Url.findOne({ shortcode: finalShortcode }))
        }

        const expiry = new Date(Date.now() + validity * 60 * 1000)

        const newUrl = new Url({
            url,
            shortcode: finalShortcode,
            validity,
            createdAt: new Date(),
            clicks: 0,
            clickData: []
        })

        await newUrl.save()

        Log('backend', 'info', 'controller', 'Short URL created successfully')

        res.status(201).json({
            shortLink: `http://localhost:${process.env.PORT || 3000}/${finalShortcode}`,
            expiry: expiry.toISOString()
        })

    } catch (error) {
        Log('backend', 'error', 'controller', 'Error creating short URL')
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.get('/shorturls/:shortcode', async (req, res) => {
    try {
        Log('backend', 'info', 'controller', 'Get URL statistics request')
        
        const { shortcode } = req.params
        const urlData = await Url.findOne({ shortcode })

        if (!urlData) {
            Log('backend', 'warn', 'controller', 'Shortcode not found')
            return res.status(404).json({ error: 'Shortcode not found' })
        }

        const isExpired = Date.now() > (urlData.createdAt.getTime() + urlData.validity * 60 * 1000)
        
        if (isExpired) {
            Log('backend', 'warn', 'controller', 'Short URL has expired')
            return res.status(410).json({ error: 'Short URL has expired' })
        }

        Log('backend', 'info', 'controller', 'URL statistics retrieved successfully')

        res.json({
            totalClicks: urlData.clicks,
            originalUrl: urlData.url,
            createdAt: urlData.createdAt.toISOString(),
            expiryDate: new Date(urlData.createdAt.getTime() + urlData.validity * 60 * 1000).toISOString(),
            clickDetails: urlData.clickData
        })

    } catch (error) {
        Log('backend', 'error', 'controller', 'Error retrieving URL statistics')
        res.status(500).json({ error: 'Internal server error' })
    }
})

router.get('/:shortcode', async (req, res) => {
    try {
        Log('backend', 'info', 'controller', 'Redirect request received')
        
        const { shortcode } = req.params
        const urlData = await Url.findOne({ shortcode })

        if (!urlData) {
            Log('backend', 'warn', 'controller', 'Shortcode not found for redirect')
            return res.status(404).json({ error: 'Shortcode not found' })
        }

        const isExpired = Date.now() > (urlData.createdAt.getTime() + urlData.validity * 60 * 1000)
        
        if (isExpired) {
            Log('backend', 'warn', 'controller', 'Expired short URL access attempt')
            return res.status(410).json({ error: 'Short URL has expired' })
        }

        urlData.clicks += 1
        urlData.clickData.push({
            timestamp: new Date(),
            source: req.headers['user-agent'] || 'unknown'
        })

        await urlData.save()

        Log('backend', 'info', 'controller', 'Successful redirect to original URL')
        res.redirect(urlData.url)

    } catch (error) {
        Log('backend', 'error', 'controller', 'Error during redirect')
        res.status(500).json({ error: 'Internal server error' })
    }
})

app.use('/', router)

app.use((req, res) => {
    Log('backend', 'warn', 'route', 'Route not found')
    res.status(404).json({ error: 'Route not found' })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    Log('backend', 'info', 'service', `URL Shortener service started on port ${PORT}`)
    console.log(`Server running on port ${PORT}`)
})
