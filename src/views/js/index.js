let nextUrl = null;
let prevUrl = null;
let isFetching = false;

const existingTypes = {
    normal: true, fire: true, water: true,
    grass: true, electric: true, ice: false,
    fighting: true, poison: false, ground: false,
    flying: false, psychic: true, bug: false,
    rock: false, ghost: false, dragon: true,
    dark: true, steel: true, fairy: true,
};

async function collectPokemonInfo(pokemonUrl) {
    const response = await fetch(pokemonUrl);
    const pokemonListData = await response.json();
    nextUrl = pokemonListData.next;
    prevUrl = pokemonListData.previous;

    const pokemonUrls = pokemonListData.results.map(pokemon => pokemon.url);

    const pokemonList = await Promise.all(pokemonUrls.map(async (url) => {
        const response = await fetch(url);
        const pokemonData = await response.json();
        const pokedexNumber = url.match(/\/(\d+)\//)[1];
        const totalAttacks = pokemonData.moves.length;

        const attacks = await Promise.all(Array.from({ length: 2 }, async () => {
            const randomNumber = Math.floor(Math.random() * totalAttacks);
            const attackResponse = await fetch(pokemonData.moves[randomNumber].move.url);
            const attackData = await attackResponse.json();

            const englishDescription = attackData.flavor_text_entries.find(entry => entry.language.name === 'en');

            return {
                name: attackData.name,
                type: attackData.type.name,
                power: attackData.power || 0,
                description: englishDescription ? englishDescription.flavor_text.replace(/\n/g, '') : 'No description available'
            };
        }));

        const spriteUrl = pokemonData.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default || pokemonData.sprites.front_default;
        const shinyUrl = pokemonData.sprites.front_shiny;
        const hpStat = pokemonData.stats.find(stat => stat.stat.name === "hp");
        const nome = pokemonData.name.substring(0, 13);
        const pokemonType = pokemonData.types[0].type.name;

        return {
            name: nome,
            hp: hpStat,
            type: pokemonType,
            sprite: spriteUrl,
            shinySprite: shinyUrl,
            pokedexNumber: pokedexNumber,
            attacks: { allAttacks: attacks }
        };
    }));

    return pokemonList;
}

async function createDamageElements(pokemonType, attacks) {
    const typeResponse = await fetch(`https://pokeapi.co/api/v2/type/${pokemonType}`);
    const elementRelations = await typeResponse.json();
    const selectedAttacks = attacks.allAttacks.slice(0, 2);

    let halfDamage = '';
    let doubleDamage = '';
    let attackDivsHTML = '';

    elementRelations.damage_relations.double_damage_from.forEach(type => {
        if (existingTypes[type.name]) {
            doubleDamage += `<span class="element" data-type="${type.name}"></span>`;
        }
    });

    elementRelations.damage_relations.half_damage_from.forEach(type => {
        if (existingTypes[type.name]) {
            halfDamage += `<span class="element" data-type="${type.name}"></span>`;
        }
    });

    selectedAttacks.forEach(attack => {
        let powerOrbs = '';
        const powerLevel = attack.power;

        if (powerLevel >= 100) powerOrbs = `<span class="elementAttack" data-type="${attack.type}"></span>`.repeat(3);
        else if (powerLevel >= 60 || powerLevel === 0) powerOrbs = `<span class="elementAttack" data-type="${attack.type}"></span>`.repeat(2);
        else if (powerLevel < 60) powerOrbs = `<span class="elementAttack" data-type="${attack.type}"></span>`;

        attackDivsHTML += `
            <div class="attackDivLast"> 
                ${powerOrbs}
                <h3 class="tituloAttack">${attack.name}</h3>
                <span class="damage">${attack.power}</span>
                <p>${attack.description}</p>
            </div>
        `;
    });

    return { doubleDamage, halfDamage, attackDivsHTML };
}

async function createPokemonCardHtml(pokemon) {
    const { doubleDamage, halfDamage, attackDivsHTML } = await createDamageElements(pokemon.type, pokemon.attacks);
    return `
        <div class="card exit" data-type="${pokemon.type}">
            <img class="pokemon2" src="${pokemon.shinySprite}" alt="${pokemon.name} Shiny"> 
            <h2 class="nome">${pokemon.name}</h2>
            <span class="hp">${pokemon.hp.base_stat}</span>
            <div class="card-pokemon">
                <img class="pokemon" src="${pokemon.sprite}" alt="${pokemon.name}">
            </div>
            <div class="attackDiv"> 
                ${attackDivsHTML}
            </div>
            <div class="elementContent">
                <div class="modifier">${doubleDamage}</div>
                <div class="modifier">${halfDamage}</div>
            </div>
            <span class="dexNumber">${pokemon.pokedexNumber}</span>
        </div>
    `;
}

function applyTypeBackgrounds() {
    document.querySelectorAll('.card').forEach(card => {
        const type = card.getAttribute('data-type');
        const position = getComputedStyle(document.documentElement).getPropertyValue(`--carta-${type}`);
        card.style.setProperty('--background-position', position);
    });
}

function applyElementBackgrounds() {
    document.querySelectorAll('.element').forEach(element => {
        const type = element.getAttribute('data-type');
        const position = getComputedStyle(document.documentElement).getPropertyValue(`--orbElement-${type}`);
        element.style.setProperty('background-position', position);
    });
    document.querySelectorAll('.elementAttack').forEach(element => {
        const type = element.getAttribute('data-type');
        const position = getComputedStyle(document.documentElement).getPropertyValue(`--orbElementAttack-${type}`);
        element.style.setProperty('background-position', position);
    });
}

function animateCards() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.classList.remove('exit');
        setTimeout(() => {
            card.classList.add('enter');
        }, 50); 
    });
}

function navigate(direction) {
    if (direction === 'next' && nextUrl) fetchPokemons(nextUrl);
    else if (direction === 'prev' && prevUrl) fetchPokemons(prevUrl);
}
function keyDownFunction(event) {
    if (event.keyCode === 37 || event.keyCode === 65) navigate('prev');
    if (event.keyCode === 68 || event.keyCode === 39) navigate('next');
}
async function fetchPokemons(url = 'https://pokeapi.co/api/v2/pokemon/?offset=0&limit=3') {
    if (isFetching) return;
    isFetching = true;

    const pokemonList = await collectPokemonInfo(url);

    const main = document.getElementById('main');
    main.innerHTML = '';

    for (const pokemon of pokemonList) {
        const pokemonCardHtml = await createPokemonCardHtml(pokemon);
        main.innerHTML += pokemonCardHtml;
    }

    applyTypeBackgrounds();
    applyElementBackgrounds();
    animateCards();

    isFetching = false;
}

window.addEventListener('load', () => fetchPokemons());

document.getElementById('next-button').addEventListener('click', () => navigate('next'));
document.getElementById('prev-button').addEventListener('click', () => navigate('prev'));
document.addEventListener('keydown', keyDownFunction);