const { showDataVisualization } = require('./dataProcessor');
const { sendInferenceRequest } = require('./inference');
const { writeCodeForML } = require('./codeGenerator');
const { startChat, startInputChat } = require('./chat');
const blessed = require('blessed');
const { exec } = require('child_process');
const figlet = require('figlet');
const fs = require('fs');
const csv = require('fast-csv');

const screen = blessed.screen({
    smartCSR: true,
    title: 'Interactive CLI'
});

const convertCsvToTxt = (csvFilePath, txtFilePath) => {
    const csvStream = fs.createReadStream(csvFilePath)
        .pipe(csv.parse({ headers: true }))
        .on('data', (row) => {
            fs.appendFileSync(txtFilePath, JSON.stringify(row) + '\n');
        })
        .on('end', () => {
            //console.log(`CSV data successfully written to ${txtFilePath}`) debugging, uncomment during testing
        })
        .on('error', (error) => {
            console.error('Error processing CSV file:', error);
        });
};

const csvFilePath = __dirname + '/../input.csv';
const txtFilePath = 'input.txt';
fs.writeFileSync(txtFilePath, '');
convertCsvToTxt(csvFilePath, txtFilePath);

figlet('Instinct Analytics', (err, data) => {
    if (err) {
        console.log('Something went wrong...');
        console.dir(err);
        return;
    }

    const titleBox = blessed.box({
        top: 0,
        left: 'center',
        width: '100%',
        height: 'shrink',
        content: data,
        tags: true,
        style: {
            fg: 'cyan',
            bg: 'black',
            border: {
                fg: 'blue'
            }
        }
    });

    const screenWidth = screen.width;
    const titleBoxWidth = data.split('\n')[0].length; // Width of the ASCII art
    const leftPosition = Math.max(0, Math.floor((screenWidth - titleBoxWidth) / 2));

    titleBox.left = leftPosition;

    screen.append(titleBox);
    screen.render();
});

const menu = blessed.list({
    parent: screen,
    items: [
        'Observe Data',
        'Talk to Data',
        'AI Recommendations/Inferences',
        'Write Code for ML'
    ],
    border: {
        type: 'line'
    },
    style: {
        selected: {
            bg: 'blue'
        }
    },
    keys: true,
    top: 'center',
    left: 'center',
    width: '50%',
    height: '50%'
});

screen.append(menu);
menu.focus();
screen.render();

menu.on('select', (node, index) => {
    switch (index) {
        case 0:
            showDataVisualization(csvFilePath, screen, menu); 
            break;
        case 1:
            //use this for now unless I have extra time
            exec('start cmd /k "node chat.js main"', { cwd: __dirname });
            exec('start cmd /k "node chat.js input"', { cwd: __dirname });
            break;
        case 2:
            sendInferenceRequest(screen, menu);
            break;
        case 3:
            writeCodeForML(screen, menu);
            break;
    }
});

const instructions = blessed.box({
    bottom: 0,
    left: 0,
    width: 'shrink',
    height: 'shrink',
    content: 'Use arrow keys or W/S to move and Enter to select',
    tags: true,
    style: {
        fg: 'white',
        bg: 'black'
    }
});

screen.append(instructions);

screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

screen.render();
