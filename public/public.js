$(document).ready(function () {

    // WebSocket
    const socket = io();

    // DOM элементы
    const $cells = $('.cell');
    const $confirmButton = $('.confirm-button');
    const $alphabetPoup = $('.alphabet-poup');
    const $arrow = $('.arrow');
    const $errorContainer = $('.error-message');
    const findGameButton = $('#findGameButton');
    const modalContainer = $('.welcome-modal-container');

    // Игровые элементы
    const wordInList = $('<p>').text('Почти вышло, но слово уже использовалось');
    const wordNotFound = $('<p>').html('Cлово не найдено в словаре :(');
    const letterNotInserted = $('<p>').html('Нужно вставить букву...');
    let playerNumber;
    let currentWordsList = [];
    let currentWord = [];
    let lastAddedCell;
    let $lastLetter;
    let isLastLetterSelected = false;
    let $prevLastLetter;
    let isFirstLetter = true;
    let isLetterInserted = false;
    let playerTurn;
    let score = 0;


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

        if ($selectedCell.length > 0) {
            const $cellText = $selectedCell.find('.cell-text');
            if (!$cellText.text().trim()) {
                const letter = $(this).text();
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

        score = currentWord.length;

        socket.emit('check-word', word);

        $cells.removeClass('selected first-letter');
        isFirstLetter = true;
        currentWord = [];
        $errorContainer.removeClass('animation-active');
        wordInList.remove();
        wordNotFound.remove();
        letterNotInserted.remove();
    }

    // Функция для проверки слова в словаре
    socket.on('check-word-response', (data) => {
        const word = data.word;
        const isValidWord = data.valid;

        if (isValidWord && !currentWordsList.includes(word) && word !== '' && isLetterInserted) {
            addToHistory(playerNumber, word);
            updateScore(playerNumber, score);
            currentWordsList.push(word);
            switchPlayers(playerTurn);
        } else if (!isLetterInserted) {
            errorMessage(letterNotInserted);
        } else if (currentWordsList.includes(word)) {
            errorMessage(wordInList);
            if (lastAddedCell) lastAddedCell.find('.cell-text').text('');
        } else {
            errorMessage(wordNotFound);
        }

        updateCellAccessibility();
        isLetterInserted = false;
        isLastLetterSelected = false;
    });

    // Функция для добавления слова в историю
    function addToHistory(playerID, word) {
        const history = $(`#history${playerID}`);
        const p = $('<p>').text(word);

        history.append(p);
    }

    // Функция для обновления счета
    function updateScore(playerID, score) {
        const dataToSend = {
            playerID: playerID,
            score: score
        }

        fetch('/update-score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        })
        .then(response => {
            if (!response.ok) throw new Error('Ошибка при обновлении счета');
            return response.json();
        })
        .then(updateScore => {
            const scoreElement = $(`#score${updateScore.playerID}`);
            scoreElement.text(updateScore.score);
        })
        .catch(error => {
            console.error('Ошибка при обновлении счета: ', error);
        });
    }

    // Функция для переключения игроков
    function switchPlayers(playerTurn) {
        socket.emit('switch-players', { playerTurn: playerTurn });

        socket.on('switch-players', (data) => {
            if (playerNumber === data.playerTurn) {
                $cells.css('pointer-events', 'auto');
                $arrow.css('transform', `rotate(180deg)`);
            } else if (playerTurn === 0) {
                if (playerNumber === data.randomPlayer) $arrow.css('transform', `rotate(180deg)`);
                else $arrow.css('transform', `rotate(0deg)`);
            } else {
                $cells.css('pointer-events', 'none');
                $arrow.css('transform', `rotate(0deg)`);
            }
        });
    }

    // Функция для отображения ошибки
    function errorMessage(message) {
        $errorContainer.addClass('animation-active');
        $errorContainer.append(message);
    }


    // Обработчик клика на ячейку
    $cells.on('click', handleCellClick);

    // Обработчик клика на букву в алфавите
    $alphabetPoup.on('click', '.letter', handleAlphabetClick);

    // Обработчик кнопки Подтвердить
    $confirmButton.on('click', handleConfirmButtonClick);


    // Инициализация игры
    function initializeGame(randomWord) {
        currentWordsList.push(randomWord);

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


    // Начало игры

    findGameButton.on('click', () => {
        findGameButton.prop('disabled', true);
        socket.emit('find-game');
    });

    socket.on('start-game', (data) => {
        const gameID = data.gameID;
        const word = data.word;

        playerNumber = data.player;

        switchPlayers(playerTurn);
        initializeGame(word);

        modalContainer.hide();
        console.log(`Игра началась. Игрок ${playerNumber}, игра с ID ${gameID}`);
    });

    socket.on('game-over', (data) => {
        console.log(data.message);
    });
});
