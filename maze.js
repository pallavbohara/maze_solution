// Characters that will be used as cell content:
let box = " SE╝ ═╚╩ ╗║╣╔╦╠╬";
// blank = brick, S = start, E = end.
// The position of the character is a 4 bit number. Each bit represents a direction
// (east, north, west, south), and is set to 1 when that direction is enabled.
// Exceptions are S and E which have all four directions enabled.

// Determine which rotations make sense for each character.
let rotations = { 
    " ": [] // A brick has no rotations
};
for (let i = 1; i < 16; i++) {
    let chr = box[i];
    if (chr == " ") continue;
    let rot = [];
    let j = i;
    if ("╬SE".includes(chr)) { // rotating does not change anything
        rot.push(0xF);
    } else { // can turn 90° to different shape
        rot.push(j, j = bitRotate(j));
        if (!"═║".includes(chr)) { // shape has more than two states
            rot.push(j = bitRotate(j), bitRotate(j)); 
        }
    }
    rotations[chr] = rot;
}

class Node {
    constructor(name, row, col, chr) {
        this.name = name;
        this.row = row;
        this.col = col;
        this.chr = chr;
        // One potential entry for each direction: East, North, West, South
        this.neighbors = [null, null, null, null];
    }
    addNeighbor(direction, neighbor) {
        if (!neighbor) return;
        this.neighbors[direction] = neighbor;
        neighbor.neighbors[direction ^ 2] = this; // reverse direction
    }
}

function createGraph(grid) {
    let height = grid.length;
    let width = grid[0].length;
    let startNode = null;
    let nodes = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (grid[i][j] == " ") {
                nodes[j] = null;
            } else {
                let node = new Node(JSON.stringify([i, j]), i, j, grid[i][j]);
                // if there is a node left, log it as neighbor
                if (j > 0) node.addNeighbor(0, nodes[j-1]);
                // if there is a node above, log it as neighbor
                if (i > 0) node.addNeighbor(1, nodes[j]);
                if (node.chr == "S") startNode = node;
                nodes[j] = node;
            }
        }
    }
    return startNode;
}

function extendPath(path) {
    let node = path[path.length-1];
    // Get direction (bit) at which we entered last node in path
    let entry = 1;
    if (path.length > 1) entry = 1 << node.neighbors.indexOf(path[path.length-2]);
    let rot = rotations[node.chr];
    let exits = 0;
    let remainingExits = 0xF;
    let paths = [];
    for (let i = 0; i < rot.length && remainingExits > 0; i++) {
        if ((rot[i] & entry) == 0) continue; // Cannot enter at this rotation
        let exits = (rot[i] ^ entry) & remainingExits;
        remainingExits ^= exits;
        let j = 0;
        while (exits) {
            let neighbor = node.neighbors[j];
            // Can exit in direction j? Only when:
            // - rotation allows it
            // - there is an edge (not off-grid; not visited before)
            // - not going to a node that is already on this path
            if ((exits & 1) && neighbor && !path.includes(neighbor)) {
                paths.push([i, path.concat(neighbor)]);
            }
            exits >>= 1;
            j++;
        }
    }
    return paths;
}

// Use delays so the algorithm's progress can be visualised
const delay = () => new Promise(resolve => setTimeout(resolve, 10));

async function shortestPath(grid, listener) {
    // Convert to an easier to use data structure:
    let startNode = createGraph(grid);
    // As a BFS priority queue, use an array indexed by total made rotations,
    // and for each index, store a list of paths that use that many rotations.
    // The maximum number of rotations per node is 3, so the total made rotations
    // cannot be more than 3 times the number of cells in the grid.
    let paths = []; // This is a dynamicly growing array
    paths[0] = [[startNode]]; // Initial path has 0 rotations and has just the start node.
    for (let cost = 0; cost < paths.length; cost++) {
        let cheapPaths = paths[cost] || [];
        for (let j = 0; j < cheapPaths.length; j++) {
            let path = cheapPaths[j];
            if (path.length > 1) {
                // Check that the edge was not yet visited
                let [prev, curr] = path.slice(path.length-2); // get last two nodes
                let dir = prev.neighbors.indexOf(curr);
                if (dir < 0) continue; // edge was already visited
                // Visit the directed edge by removing it from the graph
                prev.neighbors[dir] = null;
            }
            if (listener) {
                listener(path.map(node => [node.row, node.col]));
                await delay();
            }
            // Did we reach the target?
            if (path[path.length-1].chr == "E") return cost;
            for (let [rotation, nextPath] of extendPath(path)) {
                let newCost = cost + rotation;
                if (!paths[newCost]) paths[newCost] = []; // extend array
                paths[newCost].push(nextPath);
            }
        }
    }
    return Infinity; // no solution found
}

function generateGrid(width, height) {
    let grid = Array.from({length: height}, () => 
        Array.from({length: width}, () => " ╝═╚╩╗║╣╔╦╠╬"[Math.floor(Math.random() * 12)])
    );
    // For this demo, we always put the start/end nodes in the opposite corners
    grid[0][0] = "S"; // starting node
    grid[7][7] = "E"; // ending node
    return grid;
}

function bitRotate(bits) { // Rotate 4 bits:
    return ((bits << 1) | +(bits >= 8)) & 0xF;
}

// All below is for I/O handling with DOM

(function () {
    let table = document.querySelector("#game");
    let msg = document.querySelector("#msg");
    let btnScramble = document.querySelector("#scramble");
    let btnSolve = document.querySelector("#solve");
    let grid;

    function newGame() {
        grid = generateGrid(8, 8);
        display();
    }

    function display(path=[]) {
        // Create HTML table contents from scratch
        table.innerHTML = grid.map(row =>
            `<tr>${row.map(chr => `<td>${htmlBox(chr)}<\/td>`).join("")}<\/tr>`
        ).join("");
        // If a path argument was given, then color that path
        let cost = 0;
        for (let i = 0; i < path.length; i++) {
            let p = path[i];
            let numRotations = 0;
            if (i > 0 && i < path.length-1) {
                numRotations = rotationCount(grid, path[i-1], p, path[i+1], path[path.length-1].join() === "7,7");
            }
            table.rows[p[0]].cells[p[1]].style.backgroundColor = 
                ["yellow", "orange", "red", "purple"][numRotations];
            cost += numRotations;
        }
        if (path.length) {
            msg.textContent = "Used " + cost + " rotations...";
        } else {
            msg.textContent = "";
        }
    }
    
    async function solve() {     
        btnScramble.disabled = true;
        btnSolve.disabled = true;
        // As the algorithm progresses, call display
        let cost = await shortestPath(grid, display);
        msg.textContent = cost === Infinity ? "No path found" : "Minimal number of rotations = " + cost;
        btnScramble.disabled = false;
        btnSolve.disabled = false;
    }

    newGame(); // immediately create a game on page load

    btnScramble.addEventListener("click", newGame);
    btnSolve.addEventListener("click", solve);

    table.addEventListener("click", function (e) {
        if (btnSolve.disabled) return; // do not allow changing the grid while solving
        let td = e.target.closest("#game>tbody>tr>td");
        if (!td) return;
        rotate(grid, td.cellIndex, td.parentNode.rowIndex);
        display();
    });
})();

function rotate(grid, x, y) {
    let chr = grid[y][x];
    if ("SE╬ ".includes(chr)) return false; // nothing to turn
    let bits = box.indexOf(chr);
    grid[y][x] = box[bitRotate(bits)];
    return true;
}

function rotationCount(grid, a, b, c) {
    let entry = a[1] < b[1] ? 1 
              : a[1] > b[1] ? 4
              : a[0] < b[0] ? 2 : 8;
    let exit  = c[1] < b[1] ? 1
              : c[1] > b[1] ? 4
              : c[0] < b[0] ? 2 : 8;
    let needed = entry + exit;
    let actual = box.indexOf(grid[b[0]][b[1]]);
    for (let count = 0; count < 4; count++) {
        if ((actual & needed) == needed) return count;
        actual = bitRotate(actual);
    }
    throw "rotation not found";
}

function htmlBox(chr) {
    if (chr == "S") return "🐇";
    if (chr == "E") return "🏠";
    let bits = box.indexOf(chr);
    return "<table>"
        + `<tr><td class="black"><\/td><td class="${color(bits, 2)}"><\/td><td class="black"><\/td><\/tr>`
        + `<tr><td class="${color(bits, 1)}"><\/td><td class="white"><\/td><td class="${color(bits, 4)}"><\/td><\/tr>` 
        + `<tr><td class="black"><\/td><td class="${color(bits, 8)}"><\/td><td class="black"><\/td><\/tr>`
    + "</table>";
}

function color(bits, bit) {


    return bits & bit ? "white" : "black";
}
