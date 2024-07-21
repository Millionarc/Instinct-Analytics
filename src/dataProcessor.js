const fs = require('fs');
const csv = require('fast-csv');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

const processCsvFile = async (filePath) => {
    const data = [];
    const columns = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv.parse({ headers: true }))
            .on('error', error => reject(error))
            .on('headers', headers => {
                columns.push(...headers);
            })
            .on('data', row => data.push(row))
            .on('end', () => resolve({ data, columns }));
    });
};

const showDataVisualization = async (filePath, screen, mainMenu) => {
    try {
        const { data, columns } = await processCsvFile(filePath);

        const grid = new contrib.grid({
            rows: 12,
            cols: 12,
            screen: screen 
        });

        const widgets = [];

        columns.forEach((column, index) => {
            const row = Math.floor(index / 4) * 3; 
            const col = (index % 4) * 3; 

            const bar = grid.set(row, col, 3, 3, contrib.bar, {
                label: column,
                barWidth: 6,
                barSpacing: 6,
                xOffset: 0,
                maxHeight: 9
            });

            widgets.push(bar);

            const columnValues = data.map(row => row[column]);
            const isNumericColumn = columnValues.every(value => !isNaN(parseFloat(value)));

            if (isNumericColumn) {
                const ranges = {};
                columnValues.forEach(value => {
                    const bucket = Math.floor(value / 10) * 10;
                    ranges[bucket] = (ranges[bucket] || 0) + 1;
                });

                const titles = Object.keys(ranges).map(range => `${range}-${parseInt(range) + 9}`);
                const values = Object.values(ranges);

                bar.setData({
                    titles: titles,
                    data: values
                });
            } else {
                const categoryCounts = columnValues.reduce((acc, value) => {
                    acc[value] = (acc[value] || 0) + 1;
                    return acc;
                }, {});

                const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

                const titles = [];
                const values = [];

                if (sortedCategories.length > 0) {
                    titles.push(sortedCategories[0][0]);
                    values.push(sortedCategories[0][1]);
                }
                if (sortedCategories.length > 1) {
                    titles.push(sortedCategories[1][0]);
                    values.push(sortedCategories[1][1]);
                }
                if (sortedCategories.length > 2) {
                    const otherCount = sortedCategories.slice(2).reduce((acc, val) => acc + val[1], 0);
                    titles.push('Other');
                    values.push(otherCount);
                }

                bar.setData({
                    titles: titles,
                    data: values
                });
            }
        });

        const backToMenuText = blessed.text({
            bottom: 0,
            left: 0,
            content: 'Press b to go back to the main menu',
            style: {
                fg: 'white',
                bg: 'black'
            }
        });
        screen.append(backToMenuText);

        screen.key(['b'], () => {
            screen.remove(backToMenuText);
            widgets.forEach(widget => screen.remove(widget)); 
            mainMenu.show();
            mainMenu.focus();
            screen.render();
        });

        screen.key(['q', 'C-c'], () => process.exit(0));

        screen.render();
    } catch (error) {
        console.error('Error showing data visualization:', error);
    }
};

module.exports = {
    processCsvFile,
    showDataVisualization
};
