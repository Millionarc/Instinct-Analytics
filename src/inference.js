const blessed = require('blessed');
const fs = require('fs');
const csv = require('fast-csv');
const axios = require('axios');
const OpenAI = require('openai');

const CSV_FILE = __dirname + '/../input.csv';

const readCSVContents = async () => {
    const csvData = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_FILE)
            .pipe(csv.parse({ headers: true }))
            .on('data', row => csvData.push(row))
            .on('end', () => resolve(csvData))
            .on('error', error => reject(error));
    });
};

const sendInferenceRequest = async (mainScreen, mainMenu) => {
    const messageBox = blessed.box({
        top: 'top',
        left: 'center',
        width: '80%',
        height: '80%',
        content: 'Analyzing Data',
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

    mainScreen.append(messageBox);

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
    mainScreen.append(instructions);

    mainScreen.render();

    let thinkingInterval;
    const showThinking = () => {
        let dots = '';
        thinkingInterval = setInterval(() => {
            dots += '.';
            if (dots.length > 4) dots = '';
            messageBox.setContent(`Analyzing Data${dots}`);
            mainScreen.render();
        }, 250);
    };

    try {
        const csvContents = await readCSVContents();
        const formattedCSV = JSON.stringify(csvContents, null, 2);

        const prompt = `Data Analysis Task:
        You are provided with a dataset containing various attributes. Your task is to analyze this data and draw conclusions on what the output is and what most influences the output. Format your response as follows:
        
        1. **Possible Influences On Data**: List potential influences and what they are most likely to be. Include Percentages Where Possible
        2. **Conclusions/inferred relationships**: Based on the dataset, list any conclusions, inferred relationships, up to 5. Include Percentages Where Possible 
        3. **Recommended Features to Add**: Suggest features that could be added to improve analysis.
        4. **Model Recommendations**: Recommend models or algorithms suitable for this analysis.
        
        Data: ${formattedCSV}`;

        const client = new OpenAI({
            baseURL: "https://3eb7-71-217-57-212.ngrok-free.app/v1",
            apiKey: "lm-studio"
        });

        showThinking();

        const completion = await client.chat.completions.create({
            model: "QuantFactory/Meta-Llama-3-8B-Instruct-GGUF",
            messages: [
                { role: "system", content: `Data Analysis Task:
        You are provided with a dataset containing various attributes. Your task is to analyze this data and draw conclusions on what the output is and what most influences the output. Format your response as follows:
        
        1. **Possible Influences On Data**: List potential influences and what they are most likely to be. Include Percentages Where Possible
        2. **Conclusions/inferred relationships**: Based on the dataset, list any conclusions, inferred relationships, up to 5. Include Percentages Where Possible 
        3. **Recommended Features to Add**: Suggest features that could be added to improve analysis.
        4. **Model Recommendations**: Recommend models or algorithms suitable for this analysis.
        `},
                { role: "user", content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 500,
        });

        clearInterval(thinkingInterval);

        messageBox.setContent(`${completion.choices[0].message.content}`);
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
    sendInferenceRequest
};
