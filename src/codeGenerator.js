const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const axios = require('axios');
const { OpenAI } = require('openai');
require('dotenv').config();

const CSV_FILE = path.join(__dirname, '../input.csv');

const readCSVSummary = async () => {
    const csvData = [];
    const summary = {
        columns: [],
        sampleRows: [],
        stats: {}
    };

    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_FILE)
            .pipe(csv.parse({ headers: true }))
            .on('data', row => {
                csvData.push(row);
                if (summary.sampleRows.length < 5) {
                    summary.sampleRows.push(row);
                }
            })
            .on('end', () => {
                summary.columns = Object.keys(csvData[0]);

                summary.columns.forEach(column => {
                    const values = csvData.map(row => row[column]);
                    const numericValues = values.filter(value => !isNaN(value)).map(Number);

                    if (numericValues.length > 0) {
                        const mean = (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2);
                        const median = numericValues.sort((a, b) => a - b)[Math.floor(numericValues.length / 2)];
                        const stddev = Math.sqrt(numericValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / numericValues.length).toFixed(2);

                        summary.stats[column] = { mean, median, stddev };
                    } else {
                        summary.stats[column] = {
                            uniqueValues: [...new Set(values)].length
                        };
                    }
                });

                resolve(summary);
            })
            .on('error', error => reject(error));
    });
};

const writeToNotebook = (codeCells) => {
    const notebook = {
        cells: codeCells.map(code => ({
            cell_type: "code",
            source: code.split('\n'),
            metadata: {},
            outputs: [],
            execution_count: null
        })),
        metadata: {},
        nbformat: 4,
        nbformat_minor: 5
    };
    fs.writeFileSync('output.ipynb', JSON.stringify(notebook, null, 2));
};

const writeCodeForML = async (mainScreen, mainMenu) => {
    const messageBox = blessed.box({
        top: 'top',
        left: 'center',
        width: '80%',
        height: '80%',
        content: 'Generating Code',
        border: {
            type: 'line'
        },
        style: {
            border: {
                fg: 'blue'
            }
        },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: ' ',
            track: {
                bg: 'blue'
            },
            style: {
                inverse: true
            }
        }
    });

    const instructions = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 3,
        content: 'Press [b] to return to the main menu | Press [j] and [k] to scroll',
        style: {
            fg: 'white',
            bg: 'black'
        }
    });

    mainScreen.append(messageBox);
    mainScreen.append(instructions);

    mainScreen.render();

    let thinkingInterval;
    const showThinking = () => {
        let dots = '';
        thinkingInterval = setInterval(() => {
            dots += '.';
            if (dots.length > 4) dots = '';
            messageBox.setContent(`Generating Code${dots}`);
            mainScreen.render();
        }, 250);
    };

    try {
        const summary = await readCSVSummary();

        const prompt = `Machine Learning Task:
Given the data provided below, write a Jupyter Notebook that includes the following sections as separate code cells:

1. **Data Loading and Inspection**: Write code to load the dataset and inspect the first few rows. Include comments explaining each step.
    - Ensure the dataset is correctly loaded using pandas and display the first few rows.
    - Print information about each column and summary statistics.

2. **Data Preprocessing and Cleaning**: Write code to preprocess and clean the data. Include comments explaining each step.
    - Handle missing values appropriately, using imputation or deletion as necessary.
    - Convert categorical variables to numerical variables using techniques like one-hot encoding.
    - Ensure the target variable is converted to numeric if it is categorical.
    - Validate conversions by printing the first few rows of the processed data.

3. **Exploratory Data Analysis (EDA)**: Write code to perform exploratory data analysis on the dataset. Include visualizations and comments explaining each step.
    - Generate visualizations like count plots, box plots, and histograms to understand the distribution of data.
    - Comment on insights derived from the visualizations.

4. **Model Training and Evaluation**: Write code to train a machine learning model on the dataset and evaluate its performance. Include comments explaining each step.
    - Split the data into training and testing sets.
    - Create a preprocessing pipeline for handling both categorical and numerical features.
    - Train a Linear Regression model and ensure that the target variable is numeric.
    - Evaluate the model using metrics like Mean Squared Error (MSE) and R-squared (R²).
    - Print the evaluation metrics and predicted vs actual values for validation.

5. **Conclusion and Future Work**: Write code to summarize the findings and suggest future work. Include comments explaining each step.
    - Summarize the model's performance and any patterns observed.
    - Suggest potential improvements and further analysis that could be performed.

Ensure all explanations are commented out in the notebook.

CSV Columns: ${summary.columns.join(', ')}

Sample Rows: ${JSON.stringify(summary.sampleRows, null, 2)}

Column Statistics: ${JSON.stringify(summary.stats, null, 2)}`;

        const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY 
        });

        showThinking();

        const completion = await client.chat.completions.create({
            model: "gpt-4", //try other models
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4000,
        });

        clearInterval(thinkingInterval);

        const codeBlocks = completion.choices[0].message.content.split(/```(?:python)?\s*([\s\S]*?)\s*```/).filter((_, index) => index % 2 === 1);

        writeToNotebook(codeBlocks);

        messageBox.setContent('Written code is in output.ipynb, please be aware this code may have issues and need debugging.');
        mainScreen.render();
    } catch (error) {
        clearInterval(thinkingInterval);
        if (axios.isAxiosError(error)) {
            messageBox.setContent(`Axios error: ${error.response?.data || error.message}`);
        } else {
            messageBox.setContent(`Unexpected error: ${error}`);
        }
        mainScreen.render();
    }

    mainScreen.key(['b'], () => {
        messageBox.detach(); 
        instructions.detach(); 
        mainMenu.focus(); 
        mainScreen.render();
    });

    mainScreen.key(['j'], () => {
        messageBox.scroll(1);
        mainScreen.render();
    });

    mainScreen.key(['k'], () => {
        messageBox.scroll(-1);
        mainScreen.render();
    });

    mainScreen.on('mouse', (data) => {
        if (data.action === 'wheelup') {
            messageBox.scroll(-1);
            mainScreen.render();
        } else if (data.action === 'wheeldown') {
            messageBox.scroll(1);
            mainScreen.render();
        }
    });

    mainScreen.render();
};

module.exports = {
    writeCodeForML
};
