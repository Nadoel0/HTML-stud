const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;


// Маршруты Express
app.use(express.json());

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Функция для загрузки словаря из файла
async function loadTextFile() {
    try {
        const data = await fs.readFile(__dirname + '/public/words.txt', 'utf-8');
        const words = data.split('\n').map(word => word.trim().toUpperCase());
        return words;
    }
    catch (error) {
        console.error('Ошибка при загрузки words.txt: ', error);
        return [];
    }
}

// Функция для получения случайного слова
function getRandomWord(words) {
    const fiveLettersWords = words.filter(word => word.length === 5);
    const randomIndex = Math.floor(Math.random() * fiveLettersWords.length);
    return fiveLettersWords[randomIndex];
}

const waitingPlayers = [];
const games = {};
const playersInQueue = new Set();

io.on('connection', (socket) => {
    socket.on('find-game', async () => {
        console.log(`Игрок подключился: ${socket.id}`);

        // Проверяем, есть ли уже игрок с таким же ID в списке ожидания
        if (playersInQueue.has(socket.id)) {
            console.log(`Игрок ${socket.id} уже ожидает`);
            return;
        }

        // Добавление игрока в лист ожидания
        waitingPlayers.push(socket);

        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();
            const randomPlayer = Math.floor(Math.random() * 2) + 1;
            const words = await loadTextFile();
            const word = getRandomWord(words);
            const gameID = uuidv4();
            const game = {
                players: [player1, player2],
                gameID,
                word: word,
                playerTurn: randomPlayer,
                words: [],
                score: { score1: 0, score2: 0 }
            }

            games[gameID] = game;

            // Добавляем обоих игроков во множество игроков в очереди
            playersInQueue.add(player1.id);
            playersInQueue.add(player2.id);

            player1.emit('start-game', { gameID, player: 1, word: word, playerTurn: randomPlayer });
            player2.emit('start-game', { gameID, player: 2, word: word, playerTurn: randomPlayer });

            console.log(`Игроки ${player1.id} и ${player2.id} начали новую игру`);


            // Логика игры между двумя игроками
            // Передача ходов и событий между игроками

            socket.on('disconnect', () => {
                const game = games[gameID];

                if (game) {
                    const opponent = game.players.find((player) => player !== socket);

                    if (opponent) opponent.emit('game-over', { message: 'Ваш противник отключился' });

                    delete games[gameID];
                }

                // Удаляем игрока из множества игроков в очереди
                playersInQueue.delete(socket.id);

                const index = waitingPlayers.indexOf(socket);

                if (index !== -1) {
                    waitingPlayers.splice(index, 1);
                    console.log(`Игрок ${socket.id} удален из очереди ожидания.`);
                }
            });
        }
    });

    socket.on('add-letter', (data) => {
        const gameID = data.gameID;
        const addedLetter = data.letter;
        const rowOfAddedCell = data.row;
        const colOfAddedCell = data.col;

        const opponent = games[gameID].players.find(player => player !== socket);

        if (opponent) opponent.emit('receive-letter', { letter: addedLetter, row: rowOfAddedCell, col: colOfAddedCell });
    });

    socket.on('switch-players', (data) => {
        const gameID = data.gameID;
        let playerTurn = 0;

        playerTurn = data.playerTurn === 1 ? 2 : 1;

        if (games[gameID]) {
            games[gameID].players.forEach(player => {
                player.emit('switch-players', { playerTurn: playerTurn });
            });
        }
    });

    socket.on('add-to-history', (data) => {
        const word = data.word;
        const gameID = data.gameID;

        games[gameID].players.forEach(player => {
            player.emit('add-to-history', { word: word });
        })
    });

    socket.on('update-score', (data) => {
        const word = data.word;
        const score = word.length;
        const playerNumber = data.playerNumber;
        const gameID = data.gameID;

        games[gameID].score[`score${playerNumber}`] += score;

        games[gameID].players.forEach(player => {
            player.emit('update-score', { score: games[gameID].score[`score${playerNumber}`] });
        });
    });

    // Обработчик для событий игры
    socket.on('check-word', async (data) => {
        if (!data.word) {
            socket.emit('check-word-response', { word: '' });
            return;
        }

        const gameID = data.gameID;
        const word = data.word;
        const words = await loadTextFile();
        const isValidWord = words.includes(word);
        const wordsList = games[gameID].words || [];

        socket.emit('check-word-response', { word: word, valid: isValidWord, wordsList: wordsList });
    });

    socket.on('add-to-words-list', (data) => {
        const word = data.word;
        const gameID = data.gameID;

        games[gameID].words.push(word);
    });

    socket.on('game-event', (data) => {
        // Обработчик событий игры, переданные от игрока
        // Передачв информации о ходе другому игроку

        socket.broadcast.emit('game-event', data);
    });


    // Обработчик отключения игрока
});

// Запуск сервера
server.listen(port, () => {
    console.log(`Websocket сервер запущен на порту ${port}`);
});
