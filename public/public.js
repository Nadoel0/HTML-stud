$(document).ready(function () {

    // WebSocket
    const socket = io();

    // DOM элементы
    const $cells = $('.cell');
    const $confirmButton = $('.confirm-button');
    const $alphabetPoup = $('.alphabet-poup');
    const $arrow = $('.arrow');
    const $errorContainer = $('.error-message');
    const $findGameButton = $('#findGameButton');
    const $exitGameButton = $('.exit-game-button');
    const $endGameModal = $('#endGame');
    const $contGame = $('#contGame');
    const $exitGame = $('#exitGame');
    const $welcomeModal = $('#welcomeModal');
    const $exitModal = $('#exitGameModal');
    const $endGameTitle = $('#endGameTitle');
    const $endGameScore = $('#endGameScore');
    const $scoreElement = $('.score');

    // Игровые элементы
    const wordInList = $('<p>').html('Почти вышло, но слово уже использовалось');
    const wordNotFound = $('<p>').html('Cлово не найдено в словаре :(');
    const letterNotInserted = $('<p>').html('Нужно вставить букву...');
    let gameID;
    let playerNumber;
    let opponentNumber;
    let currentWord = [];
    let lastAddedCell;
    let $lastLetter;
    let isLastLetterSelected = false;
    let $prevLastLetter;
    let isFirstLetter = true;
    let isLetterInserted = false;
    let playerTurn = 0;
    let alphabetLetter;
    let rowOfAddedCell;
    let colOfAddedCell;
    let scores;


    // Функция обработки клика на пустую ячейку
    function handleEmptyCellClick($selectedCell) {
        if (!$selectedCell.hasClass('selected') && !isLastLetterSelected) {
            $selectedCell.addClass('selected');
            $cells.not('.selected').addClass('disabled');
            console.log('Выбрана пустая ячейка');
        } else {
            $selectedCell.removeClass('selected');
            $cells.removeClass('disabled');
            console.log('Отменен выбор пустой ячейки');
            updateCellAccessibility();
        }
    }

    // Функция обработки клика на первую букву
    function handleFirstLetterClick($selectedCell, cellText) {
        if (!currentWord.includes(cellText)) {
            $selectedCell.addClass('selected first-letter');
            currentWord.push(cellText);
            console.log('Выбрана первая буква: ', cellText);
            $lastLetter = $selectedCell;
            isLastLetterSelected = true;
            isFirstLetter = false;
        } else if ($selectedCell.hasClass('first-letter') && $('.cell.selected').not('.first-letter').length === 0) {
            $selectedCell.removeClass('selected first-letter');
            const indexToRemove = currentWord.indexOf(cellText);
            if (indexToRemove !== -1) currentWord.splice(indexToRemove, 1);
            console.log('Отменен выбор первой буквы: ', cellText);
            $lastLetter = null;
            isFirstLetter = true;
            isLastLetterSelected = false;
        }
    }

    // Функция обработки клика на след букву
    function handleNextLetterClick($selectedCell, cellText) {
        $selectedCell.addClass('selected');
        currentWord.push(cellText);
        console.log('Выбрана буква: ', cellText);
        $prevLastLetter = $lastLetter;
        $lastLetter = $selectedCell;
        isLastLetterSelected = true;
    }

    // Функция обработки клика на отмену буквы
    function handleCancelLetterClick($selectedCell, cellText) {
        $selectedCell.removeClass('selected');
        const indexToRemove = currentWord.indexOf(cellText);
        if (indexToRemove !== -1) currentWord.splice(indexToRemove, 1);
        console.log('Отмена выбранной буквы: ', cellText);
        if (currentWord.length >= 1) $lastLetter = $('.cell.selected');
        $lastLetter = $prevLastLetter;
    }

    // Функция для определения строки ячейки
    function rowOf($cell) {
        return $cell.parent().index();
    }

    // Функция для определения столбца ячейки
    function colOf($cell) {
        return $cell.index();
    }

    // Функция для определения, является ли ячейка соседней
    function isAdjacent(row1, col1, row2, col2) {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    // Обработчик нажатия на ячейку
    function handleCellClick() {
        const $selectedCell = $(this);
        const cellText = $selectedCell.find('.cell-text').text().trim();

        // Логика выбора пустой ячейки
        if (!cellText) {
            handleEmptyCellClick($selectedCell);
            // Логика выбора первой буквы
        } else if (isFirstLetter || $selectedCell.hasClass('first-letter')) {
            handleFirstLetterClick($selectedCell, cellText);
            // Логика выбора след буквы
        } else if (isAdjacent(rowOf($lastLetter), colOf($lastLetter), rowOf($selectedCell), colOf($selectedCell)) && !$selectedCell.hasClass('selected') && $lastLetter.hasClass('selected')) {
            handleNextLetterClick($selectedCell, cellText);
            // Логика отмены выбора буквы
        } else if ($selectedCell.is($lastLetter)) {
            handleCancelLetterClick($selectedCell, cellText);
        }
    }

    // Обработчик клика на букву в алфавите
    function handleAlphabetClick() {
        const $selectedCell = $('.cell.selected');
        rowOfAddedCell = $selectedCell;
        colOfAddedCell = $selectedCell;

        if ($selectedCell.length > 0) {
            const $cellText = $selectedCell.find('.cell-text');
            if (!$cellText.text().trim()) {
                const letter = $(this).text();
                alphabetLetter = letter;
                console.log(alphabetLetter);
                $cellText.text(letter);
                $selectedCell.removeClass('selected');
                $cells.find(':not(.cell-text:empty)').closest('.cell').removeClass('disabled');

                lastAddedCell = $selectedCell;
                isLetterInserted = true;
            }
        }
    }

    // Обработчик кнопки Подтвердить
    function handleConfirmButtonClick() {
        const word = currentWord.join('').toUpperCase();

        socket.emit('check-word', { word: word, gameID: gameID });

        $cells.removeClass('selected first-letter');
        isFirstLetter = true;
        currentWord = [];
        $errorContainer.removeClass('animation-active');
        $errorContainer.empty();
    }

    // Функция для проверки слова в словаре
    socket.on('check-word-response', (data) => {
        const word = data.word;
        const isValidWord = data.valid;
        const wordsList = data.wordsList;

        if (isValidWord && !wordsList.includes(word) && word !== '' && isLetterInserted) {
            addToHistory(word);
            updateScore(playerNumber, word);
            switchPlayers();
            socket.emit('add-to-words-list', { word: word, gameID: gameID });
            socket.emit('add-letter', { letter: alphabetLetter, gameID: gameID, row: rowOf(rowOfAddedCell), col: colOf(colOfAddedCell) });
        } else if (!isLetterInserted) {
            errorMessage(letterNotInserted);
        } else if (wordsList.includes(word)) {
            errorMessage(wordInList);
            if (lastAddedCell) lastAddedCell.find('.cell-text').text('');
        } else {
            errorMessage(wordNotFound);
            if (lastAddedCell) lastAddedCell.find('.cell-text').text('');
        }

        updateCellAccessibility();
        isLetterInserted = false;
        isLastLetterSelected = false;
        alphabetLetter = '';
        rowOfAddedCell = 0;
        colOfAddedCell = 0;
    });

    // Функция для добавления слова в историю
    function addToHistory(word) {
        socket.emit('add-to-history', { word: word, gameID: gameID });
    }

    socket.on('add-to-history', (data) => {
        const word = data.word;
        console.log(`Игрок ${playerNumber} ходит в ход ${playerTurn}`);
        const playerID = (playerNumber === playerTurn) ? 1 : 2;
        const history = $(`#history${playerID}`);
        const p = $('<p>').text(word);
        history.append(p);
    });

    // Функция для обновления счета
    function updateScore(playerID, word) {
        socket.emit('update-score', { playerNumber: playerID, word: word, gameID: gameID });
    }

    socket.on('update-score', (data) => {
        const updatedScore = data.score;
        scores = data.scores;

        const playerID = (playerNumber === playerTurn) ? 1 : 2;
        console.log(`Игрок ${playerID} имеет ${updatedScore} очков`);
        const scoreElement = $(`#score${playerID}`);
        scoreElement.text(updatedScore);
    });

    // Функция для переключения игроков
    function switchPlayers() {
        socket.emit('switch-players', { playerTurn: playerTurn, gameID: gameID });
    }

    socket.on('switch-players', (data) => {
        playerTurn = data.playerTurn;

        if (playerNumber === playerTurn) {
            console.log(`Игрок ${playerNumber} совпадает с ходом ${playerTurn}`);
            $cells.css('pointer-events', 'auto');
            $arrow.css('transform', `rotate(180deg)`);
        } else {
            console.log(`Игрок ${playerNumber} не совпадает с ходом ${playerTurn}`);
            $cells.css('pointer-events', 'none');
            $arrow.css('transform', `rotate(0deg)`);
        }
    });

    function isGameFinished() {
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const $cell = $(`.letters-row:eq(${row}) .cell:eq(${col}) .cell-text`);
                if ($cell.text().trim() === '') return false;
            }
        }

        return true;
    }

    socket.on('receive-letter', (data) => {
        const addedLetter = data.letter;
        const rowOfAddedCell = data.row;
        const colOfAddedCell = data.col;

        const $cell = $(`.letters-row:eq(${rowOfAddedCell}) .cell:eq(${colOfAddedCell}) .cell-text`);
        $cell.text(addedLetter);
        updateCellAccessibility();

        if (isGameFinished()) {
            if (scores.score(playerNumber) > scores.score(opponentNumber)) $endGameTitle.text('Вы победили')
            else $endGameTitle('Вы проиграли :(');
            $endGameScore.text(scores.score(playerNumber));
            showModal($endGameModal);
            clearGameBoardAndScore();
            socket.emit('exit-game', { gameID: gameID });
        }
    });

    // Функция для отображения ошибки
    function errorMessage(message) {
        $errorContainer.addClass('animation-active');
        $errorContainer.append(message);
    }

    function showModal(modalID) {
        modalID.show();
    }

    function hideModal(modalID) {
        modalID.hide();
    }


    // Обработчик клика на ячейку
    $cells.on('click', handleCellClick);

    // Обработчик клика на букву в алфавите
    $alphabetPoup.on('click', '.letter', handleAlphabetClick);

    // Обработчик кнопки Подтвердить
    $confirmButton.on('click', handleConfirmButtonClick);

    $exitGameButton.on('click', function() {
        showModal($exitModal)
    });

    $contGame.on('click', function() {
        hideModal($exitModal)
    });

    $exitGame.on('click', function() {
        hideModal($exitModal);
        showModal($welcomeModal);
        socket.emit('exit-game', { gameID: gameID });
        clearGameBoardAndScore();
        $findGameButton.prop('disabled', false);
    });


    // Инициализация игры
    function initializeGame(randomWord) {
        socket.emit('add-to-words-list', { word: randomWord, gameID: gameID })

        const middleCells = [
            $('#middleCellOne'),
            $('#middleCellTwo'),
            $('#middleCellThree'),
            $('#middleCellFour'),
            $('#middleCellFive')
        ];

        for (let i = 0; i < 5; i++) {
            middleCells[i].text(randomWord[i]);
        }

        updateCellAccessibility();
    }

    // Функция для обновления доступности ячеек
    function updateCellAccessibility() {
        $cells.each(function () {
            const $cell = $(this);
            const cellText = $cell.find('.cell-text').text().trim();

            if (!cellText && !hasAdjacentLetter($cell)) $cell.addClass('disabled');
            else $cell.removeClass('disabled');
        });

        function hasAdjacentLetter($cell) {
            const row = rowOf($cell);
            const col = colOf($cell);
            const neighbors = [
                { row: row - 1, col: col },
                { row: row + 1, col: col },
                { row: row, col: col - 1 },
                { row: row, col: col + 1 }
            ];

            for (const neighbor of neighbors) {
                const $neighborCell = getCellByCoordinates(neighbor.row, neighbor.col);
                if ($neighborCell.length > 0 && $neighborCell.find('.cell-text').text().trim()) {
                    return true;
                }
            }

            return false;
        }

        function getCellByCoordinates(row, col) {
            return $cells.eq(row * 5 + col);
        }
    }

    // Очистка игрового поля и счета
    function clearGameBoardAndScore() {
        const historyElements = $('.word-history');

        historyElements.each(function () {
            const $historyElement = $(this);
            $historyElement.empty();
        });

        $cells.find('.cell-text').text('');
        $scoreElement.text('0');
    }



    // Начало игры

    $findGameButton.on('click', () => {
        $findGameButton.prop('disabled', true);
        socket.emit('find-game');
    });

    socket.on('start-game', (data) => {
        const word = data.word;

        gameID = data.gameID;
        playerNumber = data.player;
        playerTurn = data.playerTurn;

        if (playerNumber === 1) opponentNumber = 2;
        else opponentNumber = 1;

        switchPlayers();
        initializeGame(word);
        $errorContainer.empty();

        hideModal($welcomeModal);
        console.log(`Игра началась. Игрок ${playerNumber}, игра с ID ${gameID}`);
    });

    socket.on('game-over', (data) => {
        if (isGameFinished()) {
            if (scores.score(playerNumber) > scores.score(opponentNumber)) $endGameTitle.text('Вы победили')
            else $endGameTitle('Вы проиграли :(');
            $endGameScore.text(scores.score(playerNumber));
            showModal($endGameModal);
        }
        else {
            showModal($welcomeModal);
            errorMessage($('<p>').html(data.message));
        }

        clearGameBoardAndScore();
        $findGameButton.prop('disabled', false);
        socket.emit('exit-game', { gameID: gameID });
    });
});
