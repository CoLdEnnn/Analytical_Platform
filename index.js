const express = require('express');
const path = require('path')
const mongoose = require('mongoose');
require('dotenv').config();

const cors = require('cors');
const PORT = 3000;
const app = express();
app.use(cors()); 
app.use(express.json());

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("Successfully connected to the database!"))
  .catch(err => console.error("Connection error:", err));

const measurementSchema = new mongoose.Schema(
  {
    "Formatted Date": { type: Date },
    "Temperature (C)": { type: Number },
    "Humidity": { type: Number },
    "Pressure (millibars)": { type: Number }
  },
  { collection: "measurements" }  
);

const fieldMap = {
  field1: "Temperature (C)",
  field2: "Humidity",
  field3: "Pressure (millibars)"
};

const Measurement = mongoose.model('Measurement', measurementSchema, 'measurements'); 

app.get('/', (req,res) => {
    res.sendFile(path.join(__dirname, "index.html"));
})
app.get('/api/measurements', async (req, res) => {
  try {
    const { field, start_date, end_date } = req.query;

    if (!fieldMap[field]) {
      return res.status(400).json({ error: "Invalid field" });
    }

    const query = {
      "Formatted Date": {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      }
    };

    const data = await Measurement.find(query)
      .select({
        "Formatted Date": 1,
        [fieldMap[field]]: 1,
        _id: 0
      })
      .sort({ "Formatted Date": 1 });

    res.json(
      data.map(d => ({
        timestamp: d["Formatted Date"],
        [field]: d[fieldMap[field]]
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/measurements/metrics', async (req, res) => {
  try {
    const { field, start_date, end_date } = req.query;

    if (!fieldMap[field]) {
      return res.status(400).json({ error: "Invalid field" });
    }

    const stats = await Measurement.aggregate([
      {
        $match: {
          "Formatted Date": {
            $gte: new Date(start_date),
            $lte: new Date(end_date)
          }
        }
      },
      {
        $group: {
          _id: null,
          avg: { $avg: `$${fieldMap[field]}` },
          min: { $min: `$${fieldMap[field]}` },
          max: { $max: `$${fieldMap[field]}` },
          stdDev: { $stdDevPop: `$${fieldMap[field]}` }
        }
      }
    ]);

    res.json(stats[0] || { avg: 0, min: 0, max: 0, stdDev: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});