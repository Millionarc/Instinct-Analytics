const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const { OpenAI } = require('openai');

const IPC_FILE = path.join(__dirname, 'ipc_chat.txt');
const CSV_FILE = __dirname + '/../input.csv';

const readFromIPC = () => {
    return fs.existsSync(IPC_FILE) ? fs.readFileSync(IPC_FILE, 'utf-8') : '';
};

const writeToIPC = (content) => {
    fs.writeFileSync(IPC_FILE, content, 'utf-8');
};

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


const openai = new OpenAI({
    baseURL: "https://3eb7-71-217-57-212.ngrok-free.app/v1",
    apiKey: "lm-studio"
});

const startMainChat = async () => {
    const csvContents = await readCSVContents();
    const formattedCSV = JSON.stringify(csvContents, null, 2);

    const screen = blessed.screen({
        smartCSR: true,
        title: 'Data Chat'
    });

    const chatBox = blessed.box({
        top: 'top',
        left: 'center',
        width: '100%',
        height: '85%',
        content: 'Chat with your data\n\n',
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

    screen.append(chatBox);

    const appendMessage = (message) => {
        chatBox.setContent(chatBox.getContent() + '\n' + message + '\n\n');
        chatBox.setScrollPerc(100);
        screen.render();
    };

    let thinkingIndex = -1;
    let thinkingInterval;
    const showThinking = () => {
        let dots = '';
        thinkingInterval = setInterval(() => {
            dots += '.';
            if (dots.length > 4) dots = '';
            let content = chatBox.getContent();
            let lines = content.split('\n');
            if (thinkingIndex !== -1 && lines[thinkingIndex]) {
                lines[thinkingIndex] = `AI: Thinking${dots}`;
                chatBox.setContent(lines.join('\n'));
            }
            screen.render();
        }, 250);
    };

    const sendMessage = async (text) => {
        const prompt = `Here is my input regarding the CSV file: ${text}`;
        const systemPrompt = `I will now be asking you questions regarding this CSV:\n\n${formattedCSV}`;

        appendMessage(`You: ${text}`);
        appendMessage(`AI: Thinking`);
        thinkingIndex = chatBox.getContent().split('\n').length - 3;
        showThinking();

        try {
            const completion = await openai.chat.completions.create({
                model: "QuantFactory/Meta-Llama-3-8B-Instruct-GGUF",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 800
            });

            clearInterval(thinkingInterval);
            let content = chatBox.getContent();
            let lines = content.split('\n');
            if (thinkingIndex !== -1 && lines[thinkingIndex]) {
                lines[thinkingIndex] = `AI: ${completion.choices[0].message.content}`;
                chatBox.setContent(lines.join('\n'));
            }
            screen.render();
        } catch (error) {
            clearInterval(thinkingInterval);
            let content = chatBox.getContent();
            let lines = content.split('\n');
            if (thinkingIndex !== -1 && lines[thinkingIndex]) {
                lines[thinkingIndex] = `Error: ${error.message}`;
                chatBox.setContent(lines.join('\n'));
            }
            screen.render();
        }
    };

    const checkForNewInput = () => {
        const content = readFromIPC();
        if (content) {
            fs.truncateSync(IPC_FILE, 0); 
            sendMessage(content.trim());
        }
    };

    const instructions = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 3,
        content: 'Press [up/k] and [down/j] to scroll',
        style: {
            fg: 'white',
            bg: 'black'
        }
    });
    screen.append(instructions);

    screen.key(['up', 'k'], () => {
        chatBox.scroll(-1);
        screen.render();
    });

    screen.key(['down', 'j'], () => {
        chatBox.scroll(1);
        screen.render();
    });

    setInterval(checkForNewInput, 1000);

    screen.render();
};

const startInputChat = () => {
    const screen = blessed.screen({
        smartCSR: true,
        title: 'Chat Input'
    });

    const inputBox = blessed.textbox({
        top: 'center',
        left: 'center',
        width: '100%',
        height: '10%',
        label: 'Enter your message',
        border: {
            type: 'line'
        },
        style: {
            fg: 'white',
            bg: 'black',
            border: {
                fg: 'blue'
            }
        },
        inputOnFocus: true
    });

    screen.append(inputBox);

    inputBox.on('submit', (text) => {
        writeToIPC(text.trim());
        inputBox.clearValue();
        screen.render();
        inputBox.focus();
    });

    screen.key(['q', 'C-c'], () => process.exit(0));

    inputBox.focus();
    screen.render();
};

const args = process.argv.slice(2);
if (args.includes('main')) {
    startMainChat();
} else if (args.includes('input')) {
    startInputChat();
}

module.exports = { startMainChat, startInputChat };
