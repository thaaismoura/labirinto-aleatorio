const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d");

const cellSize = 20;
let maze = [];
let player = { x: 1, y: 1 };
let goal = { x: 0, y: 0 };
let level = 1;

function generateMaze(width, height) {
  let maze = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 1)
  );

  function carve(x, y) {
    const directions = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ];

    shuffle(directions);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny > 0 && ny < height && nx > 0 && nx < width && maze[ny][nx] === 1) {
        maze[ny - dy / 2][nx - dx / 2] = 0;
        maze[ny][nx] = 0;
        carve(nx, ny);
      }
    }
  }

  maze[1][1] = 0;
  carve(1, 1);
  return maze;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function drawMaze() {
  const width = maze[0].length;
  const height = maze.length;
  canvas.width = width * cellSize;
  canvas.height = height * cellSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = maze[y][x] === 1 ? "#000" : "#fff";
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  // Player
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(
    player.x * cellSize + cellSize / 2,
    player.y * cellSize + cellSize / 2,
    cellSize / 2.5,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Goal
  ctx.fillStyle = "green";
  ctx.fillRect(goal.x * cellSize, goal.y * cellSize, cellSize, cellSize);
}

function newLevel() {
  const width = 15 + level * 2;
  const height = 15 + level * 2;
  maze = generateMaze(width, height);
  player = { x: 1, y: 1 };
  goal = { x: width - 2, y: height - 2 };
  drawMaze();
}

function move(dx, dy) {
  const newX = player.x + dx;
  const newY = player.y + dy;

  if (maze[newY] && maze[newY][newX] === 0) {
    player.x = newX;
    player.y = newY;
    drawMaze();
  }

  if (player.x === goal.x && player.y === goal.y) {
    level++;
    alert(`Parabéns! Você passou para o nível ${level}!`);
    newLevel();
  }
}

document.getElementById("up").onclick = () => move(0, -1);
document.getElementById("down").onclick = () => move(0, 1);
document.getElementById("left").onclick = () => move(-1, 0);
document.getElementById("right").onclick = () => move(1, 0);
document.getElementById("newMaze").onclick = newLevel;

newLevel();
