Array.prototype.remove = function(obj){
  var index = this.indexOf(obj);
  if (index > -1){
    return this.splice(index, 1);  
  }
  return this;
}

ANGLES = {
  down: (3 * Math.PI) / 2,
  up: Math.PI / 2,
}

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomChoice(list) {
  var index = getRandomInt(0, list.length);
  return list[index];
}

function speedToVelocity(speed, angle){
  if (speed == 0){
    return {vx: 0, vy: 0};
  }
  var vy = -1 * (Math.sin(angle) * speed);
  var vx = (Math.cos(angle) * speed);
  return { vx: vx, vy:vy };
}

function distance(from, to) {
  var dx = from.x - to.x;
  var dy = from.y - to.y;
  var dist = Math.sqrt(dx*dx + dy*dy); 
  return dist;
}

function normalizeAxisValue(value, controls) {
  value = Math.abs(value);
  if (value <= controls.AXIS_MIN_THRESHOLD) {
    return 0;
  }
  if (value >= controls.AXIS_MAX_THRESHOLD) {
    return 1;
  }
  return value;
}

function targetToVelocity(from, to, speed) {
  var deltaX = to.x - from.x;
  var deltaY = ((to.y * -1) - (from.y * -1)); // Invert Y because the canvas Y axis is inverted
  var angle = Math.atan2(deltaY, deltaX);
  return speedToVelocity(speed, angle);
}

const GAMEPAD_KEYS = {
  'Pro Controller (Vendor: 057e Product: 2009)': { // Nintendo Switch Pro Controller
    FIRE_BUTTON: 6, 
    SHIELD_BUTTON: 1, 
    VERTICAL_AXIS: 1,
    VERTICAL_AXIS_FLIPPED: true,
    HORIZONTAL_AXIS: 0,
    HORIZONTAL_AXIS_FLIPPED: false,
    AXIS_MAX_THRESHOLD: 0.5,
    AXIS_MIN_THRESHOLD: 0.1,
  },
  'Joy-Con (R) (Vendor: 057e Product: 2007)': {
    FIRE_BUTTON: 6, 
    SHIELD_BUTTON: 1, 
    VERTICAL_AXIS: 1,
    VERTICAL_AXIS_FLIPPED: true,
    HORIZONTAL_AXIS: 0,
    HORIZONTAL_AXIS_FLIPPED: false,
    AXIS_MAX_THRESHOLD: 0.5,
    AXIS_MIN_THRESHOLD: 0.1,
  },
  'default': {
    FIRE_BUTTON: 0, 
    SHIELD_BUTTON: 1, 
    VERTICAL_AXIS: 1,
    VERTICAL_AXIS_FLIPPED: false,
    HORIZONTAL_AXIS: 0,
    HORIZONTAL_AXIS_FLIPPED: false,
    AXIS_MAX_THRESHOLD: 0.5,
    AXIS_MIN_THRESHOLD: 0.1,
  },
};

function scanGamepads(game) {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!gamepads) {
    return false;
  }

  let gamepadIndex = 0;
  for (const gamepad of gamepads) {
    if (!gamepad) {
      break;
    }
    const player = game.players[gamepadIndex];
    if (!player) {
      // We may have more gamepads connected than are people playing
      break;
    }
    const controls = GAMEPAD_KEYS[gamepad.id] || GAMEPAD_KEYS.default;

    // Up/Down
    let verticalAxisValue = gamepad.axes[controls.VERTICAL_AXIS];
    if (controls.VERTICAL_AXIS_FLIPPED) {
      verticalAxisValue = verticalAxisValue * -1;  
    }

    let horizontalAxisValue = gamepad.axes[controls.HORIZONTAL_AXIS];
    if (controls.HORIZONTAL_AXIS_FLIPPED) {
      horizontalAxisValue = horizontalAxisValue * -1;  
    }

    player.keys.up = verticalAxisValue >= 0 ? normalizeAxisValue(verticalAxisValue, controls) : 0;
    player.keys.down = verticalAxisValue < 0 ? normalizeAxisValue(verticalAxisValue, controls) : 0;
    player.keys.right = horizontalAxisValue >= 0 ? normalizeAxisValue(horizontalAxisValue, controls) : 0;
    player.keys.left = horizontalAxisValue < 0 ? normalizeAxisValue(horizontalAxisValue, controls) : 0;

    player.keys.fire = gamepad.buttons[controls.FIRE_BUTTON].pressed;
    player.keys.shield = gamepad.buttons[controls.SHIELD_BUTTON].pressed;

    gamepadIndex += 1;
  }
}

function Engine(options){
  var engine = this;

  engine.loadSprites = function(){
    engine.sprites = {};
    var spriteList = [];
    for (var spriteKey of Object.keys(options.spriteSources)){
      spriteList.push(options.spriteSources[spriteKey])  ;
    }
    PIXI.loader.add(spriteList).load(function(){
      for (var spriteKey of Object.keys(options.spriteSources)){
        var source = options.spriteSources[spriteKey];
        engine.sprites[spriteKey] = new PIXI.Sprite(PIXI.loader.resources[source].texture);
      }
      options.onLoad();
    });
  };

  engine.setup = function (){
    engine.stage = new PIXI.Container(),
    engine.renderer = PIXI.autoDetectRenderer(options.width, options.height);
    engine.renderer.view.style.position = "absolute";
    engine.renderer.view.style.display = "block";
    engine.renderer.autoResize = true;

    engine.renderer.resize(options.width, options.height);

    // Add to Page
    document.getElementById(options.viewport).appendChild(engine.renderer.view);

    // Load sprites
    engine.loadSprites();
  };

  engine.render = function(){
    engine.renderer.render(engine.stage);
  };

  engine.makeCircle = function(x, y, radius, color){
    var graphic = new PIXI.Graphics();
    graphic.beginFill(color);
    graphic.drawCircle(0, 0, radius);
    graphic.endFill();
    graphic.x = x;
    graphic.y = y;
    return graphic;
  }

  engine.startArc = function(graphic, x, y, radius, start){
    graphic.moveTo(
      Math.cos(start) * radius,
      Math.sin(start) * radius
    )
  }

  engine.setup();
  return engine;
}

function PlayerShield(game, player, options){
  var shield = {
    game: game,
    player: player,
    life: 0,
    active: false,
    size: options.size || 50,
    color: 0x0000EE,
    graphic: new PIXI.Graphics(),
    arcAngle: 0,
    lastLifeCheck: null,
  };

  shield.activate = function(){
    if (shield.life){
      shield.active = true;
      shield.lastLifeCheck = (new Date()).getTime();
    }
  }
  shield.deactivate = function(){
    shield.active = false;
    if (shield.lastLifeCheck){
      var elapsed = (new Date()).getTime() - shield.lastLifeCheck;
      shield.life =  Math.max(0, shield.life - elapsed);
      shield.lastLifeCheck = null;
    }
  }
  shield.logic = function(stateInfo){
    if (player.keys.shield && !shield.active) {
      shield.activate();
    }
    if (!player.keys.shield && shield.active) {
      shield.deactivate();
    }

    shield.arcAngle = (shield.arcAngle + (stateInfo.elapsed / 120)) % (2 * Math.PI);
    if (shield.active){
      var elapsed = stateInfo.currentStateTime - shield.lastLifeCheck;
      shield.life = Math.max(0, shield.life - elapsed);
      shield.lastLifeCheck = (new Date()).getTime();
      if (shield.life == 0){
        shield.active = false;
        shield.lastLifeCheck = null;
      }
    }
    if (!shield.player.alive){
      shield.graphic.visible = false;
      return false;
    }

    // Draw
    if (shield.active){
      shield.graphic.clear();
      shield.game.engine.startArc(shield.graphic, 0, 0, shield.size / 2, 0);
      shield.graphic.lineStyle(2, shield.color, 1);
      shield.graphic.arc(0, 0, shield.size / 2, 0, 2 * Math.PI);

      shield.graphic.x = shield.player.x
      shield.graphic.y = shield.player.y
      shield.graphic.visible = true;

    } else if (shield.life){
      var endAngle = (shield.arcAngle + 1) % (2 * Math.PI);

      shield.graphic.clear();
      shield.game.engine.startArc(shield.graphic, 0, 0, shield.size / 2, shield.arcAngle);
      shield.graphic.lineStyle(2, shield.color, 1);
      shield.graphic.arc(0, 0, shield.size / 2, shield.arcAngle, endAngle);

      shield.graphic.x = shield.player.x
      shield.graphic.y = shield.player.y
      shield.graphic.visible = true;
    } else {
      shield.graphic.visible = false;
    }
  }

  shield.collide = function(bullet){
    // Bullet hit the shield
    Explosion(player.game, {x: bullet.x, y: bullet.y, size: 20, life: 300});
    bullet.remove();
  }
  game.engine.stage.addChild(shield.graphic);
  return shield;
}

function Player(game, options){
  var player = {};
  player.id = options.id,
  player.alive = true;
  player.lives = options.lives || 3;
  player.x = options.x || 0;
  player.y = options.y || 0;
  player.startX = player.x;
  player.startY = player.y;
  player.size = options.size || 30;
  player.vx = 0;
  player.vy = 0;
  player.speed = 25;
  player.invulnerable = false;
  player.weaponLevel = 0;
  player.lastFire = (new Date()).getTime();
  player.shield = PlayerShield(game, player, {size: 50});
  player.keys = {
    up: false,
    down: false,
    right: false,
    left: false,
    fire: false,
  };
  player.setKey = function(key, value){
    return function(){
      player.keys[key] = value;
    }
  }
  player.getGraphic = function(spriteSource){
    var graphic = new PIXI.Sprite(PIXI.loader.resources[spriteSource].texture);
    graphic.width = player.size;
    graphic.height = player.size;
    graphic.anchor.x = 0.5;
    graphic.anchor.y = 0.5;
    graphic.x = player.x;
    graphic.y = player.y;
    game.engine.stage.addChild(graphic);
    return graphic;
  }
  player.speedBoost = function(multiplier, duration){
    var originalSpeed = player.speed;
    player.speed = player.speed * multiplier;
    setTimeout(function(){
      player.speed = originalSpeed;
    }, duration);
  }
  player.collisionRadius = function(){
    if (player.shield.active){
      return player.shield.size / 2;
    } else {
      return player.size / 2;
    }
  }
  player.applyWeapon = function(level){
    if (!level){
      level = player.weaponLevel;
    } else if (level == '+1'){
      level = player.weaponLevel + 1;
    }

    player.weaponLevel = level;
    var weapon = {
      counter: 1, // Iteration counter for weapons that cycle
      fire: PLAYER_WEAPON.fire, // Function that sends the blast
      color: 0x00FF00,
      enemy: false,
      size: 2,  // Size of bullet it produces
      speed: 30, // Default speed 
      damage: 5, // Default damage
      cooldown: 500, // Default cooldown
    }

    if (level < 3){
      weapon.pattern = PLAYER_WEAPON.patterns.singleShot;
      weapon.cooldown = 1000;
      weapon.speed = 20 + (2 * level); // 20 - 24
      weapon.damage = 1;
    } else if (level < 5){
      weapon.pattern = PLAYER_WEAPON.patterns.tripleShot;
      weapon.cooldown = 900 - (level * 50); // 900 - 700 
      weapon.speed = 25;
      weapon.damage = 2;
    } else if (level < 7){
      weapon.pattern = PLAYER_WEAPON.patterns.partialFiveShot(4);
      weapon.speed = 26
      weapon.cooldown = 700 - ((level - 4) * 50); // 650 - 600
      weapon.damage = 3;
    } else if (level < 10){
      weapon.pattern = PLAYER_WEAPON.patterns.partialFiveShot(2);
      weapon.speed = 27;
      weapon.cooldown = 600 - ((level - 6) * 50); // 550 - 500
      weapon.damage = 4;
    } else if (level < 20){
      weapon.pattern = PLAYER_WEAPON.patterns.fiveShot;
      weapon.speed = 28
      weapon.cooldown = 500 - ((level - 9) * 10); // 500 - 400
      weapon.damage = 5;
    } else if (level < 30){
      weapon.pattern = PLAYER_WEAPON.patterns.sevenShot;
      weapon.speed = 29
      weapon.cooldown = 500 - ((level - 19) * 10); // 400 - 300
      weapon.damage = 6;
    } else if (level < 40){
      weapon.pattern = PLAYER_WEAPON.patterns.nineShot;
      weapon.speed = 30;
      weapon.cooldown = 300;
      weapon.damage = 6 + (level / 5);
    } else {
      weapon.pattern = PLAYER_WEAPON.patterns.elevenShot;
      weapon.speed = 32;
      weapon.cooldown = 200;
      weapon.damage = 6 + (level / 5);
    }
    player.weapon = weapon;
  }
  player.die = function(){
    player.graphic.visible = false;
    player.alive = false;
    player.lives -= 1;
    if (player.lives){
      setTimeout(function(){
        player.alive = true;
        player.x = player.startX;
        player.y = player.startY;
        player.graphic.visible = true;
        player.invulnerable = true;
        setTimeout(function(){
          player.invulnerable = false;
        }, 2000)
      }, 1000)
    }
  }
  player.collide = function(bullet){
    if (player.alive && !player.invulnerable){
      if (player.shield.active){
        player.shield.collide(bullet);
        return false
      }
      bullet.remove();
      player.die();
      Explosion(player.game, {x: player.x, y: player.y, size: 3 * player.size, life: 300});
    }
  }
  player.hasLife = function(){
    return player.alive || player.lives;
  }
  player.updateVelocity = function(){
    var keys = player.keys;
    var vx = 0;
    var vy = 0;
    if (keys.left){
      vx -= parseFloat(keys.left) || 1;
    }
    if (keys.right){
      vx += parseFloat(keys.right) || 1;
    }
    if (keys.up){
      vy -= parseFloat(keys.up) || 1;
    }
    if (keys.down){
      vy += parseFloat(keys.down) || 1;
    }
    if (Math.abs(vx) + Math.abs(vy) === 2) {
      vx = Math.sqrt(.5) * vx;
      vy = Math.sqrt(.5) * vy;
    }
    player.vx = vx * player.speed;
    player.vy = vy * player.speed;
  }
  player.logic = function(stateInfo){
    if (player.alive){
      // Move
      player.game.move(player, stateInfo, true);
      player.updateVelocity();

      // Fire
      if (player.keys.fire && !player.game.loading && stateInfo.currentStateTime - player.lastFire > player.weapon.cooldown){
        
        player.weapon.fire(player, player.weapon);
        player.lastFire = (new Date).getTime();
      }
    }
    player.shield.logic(stateInfo);
  }

  player.graphic = player.getGraphic(options.spriteSource);
  player.game = game;
  player.applyWeapon();

  // Add sprite 
  return player
}

function Bullet(game, opts){
  var bullet = {
    enemy: opts.enemy,
    damage: opts.damage || 1,
    x:opts.x,
    y:opts.y,
    size:opts.size,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
  };


  // Update game with self
  game.bullets.push(bullet);

  // Add graphic
  bullet.graphic = game.engine.makeCircle(bullet.x, bullet.y, opts.size, opts.color);
  game.engine.stage.addChild(bullet.graphic);

  // Add references
  bullet.game = game;


  bullet.remove = function(){
    game.removeBullets.push(bullet);
    game.engine.stage.removeChild(bullet.graphic);
  }

  // Functions
  bullet.collisionRadius = function(){
    return bullet.size / 2; 
  }

  bullet.logic = function(stateInfo){
    bullet.game.move(bullet, stateInfo);
    if (game.isOutsideViewport(bullet.x, bullet.y, bullet.size)){
      bullet.remove();
    }
  }
  return bullet;
}

PLAYER_WEAPON = {};
PLAYER_WEAPON.position = {
  primary: 1,
  left: 2,
  right: 3,
}
PLAYER_WEAPON.patterns = {
  singleShot: [{position: PLAYER_WEAPON.position.primary}],
  tripleShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
  ],
  partialFiveShot: function(i){return [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {i: i, position: PLAYER_WEAPON.position.left, angle: ANGLES.up - 0.4},
    {i: i, position: PLAYER_WEAPON.position.right, angle: ANGLES.up + 0.4},
  ]},
  fiveShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle: ANGLES.up - 0.4},
    {position: PLAYER_WEAPON.position.right, angle: ANGLES.up + 0.4},
  ],
  sevenShot:[
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.4},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.4},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.6},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.6},
  ],
  nineShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.4},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.4},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.6},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.6},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.8},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.8},
  ],
  elevenShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.4},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.4},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.6},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.6},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 0.8},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 0.8},
    {position: PLAYER_WEAPON.position.left, angle:ANGLES.up - 1},
    {position: PLAYER_WEAPON.position.right, angle:ANGLES.up + 1},
  ],
}
PLAYER_WEAPON.fire = function(player, weapon){
  weapon.counter = (weapon.counter + 1) % 100;
  for (var b of weapon.pattern){
    // Allow for the skipping of bullets that only fire on certain iterations
    if (b.i && !(weapon.counter % b.i == 0)){
      continue;
    }
    var opts = {
      color: weapon.color,
      enemy: weapon.enemy,
      damage: weapon.damage,
      size: weapon.size, 
    }
    // Calucluate Angle
    if (!b.angle){
      opts.vy = weapon.speed * -1,
      opts.vx = 0;
    } else {
      var velocity = speedToVelocity(weapon.speed, b.angle);
      opts.vx = velocity.vx;
      opts.vy = velocity.vy;
    }

    // Calculate position
    if (b.position == PLAYER_WEAPON.position.left){
      opts.x = player.x - 15;
      opts.y = player.y - 10;
    } else if (b.position == PLAYER_WEAPON.position.right){
      opts.x =  player.x + 15;
      opts.y =  player.y - 10;
    } else {
      // Primary
      opts.x = player.x;
      opts.y = player.y - 15;
    }
    Bullet(player.game, opts);
  }
}

function Booster(game, opts){
  // Props
  var booster = {
    type: opts.type || 'life',
    x:opts.x,
    y:opts.y,
    size:opts.size || 30,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
  };
  if (booster.type == 'life'){
    booster.spriteSource = game.spriteSources.boosterLife;
  } else if (booster.type == 'attack'){
    booster.spriteSource = game.spriteSources.boosterAttack;
  } else if (booster.type == 'shield'){
    booster.spriteSource = game.spriteSources.boosterShield;
  }

  // Functions
  booster.collisionRadius = function(){
    return booster.size / 2;
  }
  booster.logic = function(stateInfo){
    booster.game.move(booster, stateInfo);
    if (game.isOutsideViewport(booster.x, booster.y, booster.size)){
      booster.remove();
    }
  }
  booster.remove = function(){
      game.boosters.remove(booster);
      game.engine.stage.removeChild(booster.graphic);
  }
  booster.boost = function(player){
    if (booster.type == 'attack'){
      player.applyWeapon('+1');
    } else if (booster.type == 'life'){
      player.lives += 1;
    }
    else if (booster.type == 'shield'){
      player.shield.life += 1000;
    }
    booster.remove();
  }
  booster.getGraphic = function(){
    var graphic = new PIXI.Sprite(PIXI.loader.resources[booster.spriteSource].texture);
    graphic.width = booster.size;
    graphic.height = booster.size;
    graphic.anchor.x = 0.5;
    graphic.anchor.y = 0.5;
    graphic.x = booster.x;
    graphic.y = booster.y;
    game.engine.stage.addChild(graphic);
    return graphic;
  }

  // Update game with self
  game.boosters.push(booster);

  // Add graphic
  booster.graphic = booster.getGraphic();
  game.engine.stage.addChild(booster.graphic);

  // Add references
  booster.game = game;
  return booster;
}

function makeRandomBooster(game, percentChance, x, y){
  var random = getRandomInt(0, 100);
  if (!(random < percentChance)){
    return false; 
  }
  boosterOpts = {x:x, y:y, size: 30, vy: 10};
  var number = getRandom(0,100);
  if (number < 10){
    boosterOpts['type'] = 'life';
  } else if (number < 20){
    boosterOpts['type'] = 'shield'; 
  } else {
    boosterOpts['type'] = 'attack'; 
  }
  return Booster(game, boosterOpts);
}

function Enemy(game, level, opts){
  var enemy = {};

  enemy.x = opts.x;
  enemy.y = opts.y;
  enemy.size = opts.size;
  enemy.vx = opts.vx;
  enemy.vy = opts.vy;
  enemy.health = opts.health || Math.floor(level / 2);
  enemy.game = game;
  enemy.size = opts.size || 30;
  enemy.cooldown = opts.cooldown || Math.max(500, 1500 - (level * 50));
  enemy.bulletSpeed = opts.bulletSpeed || Math.min(30, 15 + (level / 2));
  enemy.bulletType = opts.bulletType || 'straight';
  enemy.boosterDropChance = opts.boosterDropChance || 20;
  enemy.target = randomChoice(game.players);

  enemy.die = function(){
    game.enemies.remove(enemy);
    game.engine.stage.removeChild(enemy.graphic);
    makeRandomBooster(game, enemy.boosterDropChance, enemy.x, enemy.y);
  }
  enemy.collisionRadius = function(){
    return enemy.size / 2;
  }
  enemy.collide = function(bullet){
    enemy.health -= bullet.damage;
    if (enemy.health <= 0){
      enemy.die();
      Explosion(enemy.game, {x: enemy.x, y: enemy.y, size: 3 * enemy.size, life: 300, spriteSource: 'img/_replace/explosion.png'});
    } else {
      Explosion(enemy.game, {x: enemy.x, y: enemy.y, size: 30, life: 300, spriteSource: 'img/_replace/explosion.png'});
    }
    bullet.remove();
  }
  enemy.fire = function(){
    var directions = [];
    var startLoc = {x: enemy.x, y: enemy.y};
    switch (enemy.bulletType){
      case 'random':
        var velocity = speedToVelocity(enemy.bulletSpeed, getRandom(ANGLES.down - .7, ANGLES.down + .7));
        directions.push(velocity)
        break;
      case 'targeted':
        var velocity = targetToVelocity(enemy, enemy.target, enemy.bulletSpeed);
        directions.push(velocity);
        break;
      case 'blast':
        startLoc.y += enemy.collisionRadius();
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down - 1.2));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down + 1.2));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down - .9));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down + .9));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down - .6));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down + .6));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down - .3));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down + .3));
        directions.push(speedToVelocity(enemy.bulletSpeed, ANGLES.down));
        break;
      case 'straight':
      default:
        directions.push({vy: enemy.bulletSpeed, vx: 0})
    }
    for (const dir of directions) {
      Bullet(enemy.game, {
        x: startLoc.x,
        y: startLoc.y,
        vx: dir.vx,
        vy: dir.vy,
        enemy: true,
        color: 0xe74c3c,
        size: 2
      })
    }
  }
  enemy.getGraphic = function(spriteSource){
    var graphic = new PIXI.Sprite(PIXI.loader.resources[spriteSource].texture);
    graphic.width = enemy.size;
    graphic.height = enemy.size;
    graphic.anchor.x = 0.5;
    graphic.anchor.y = 0.5;
    graphic.x = enemy.x;
    graphic.y = enemy.y;
    game.engine.stage.addChild(graphic);
    return graphic;
  }
  enemy.logic = function(state){
    if (!enemy.lastEmit ||state.currentStateTime - enemy.lastEmit > enemy.cooldown){
      enemy.lastEmit = state.currentStateTime;
      enemy.fire();
    }
  }

  enemy.graphic = enemy.getGraphic(opts.spriteSource);
  game.enemies.push(enemy);
  return enemy;
}

ENEMIES = {
  'basic': function(game, level, x, y) {
    Enemy(game, level, {
      level: level,
      x: x,
      y: y,
      spriteSource: game.spriteSources.enemy1,
      bulletType: 'straight',
    });
  },
  'randomizer': function(game, level, x, y) {
    Enemy(game, level, {
      level: level,
      x: x,
      y: y,
      spriteSource: game.spriteSources.enemy2,
      bulletType: 'random',
    });
  },
  'targeter': function(game, level, x, y) {
    Enemy(game, level, {
      level: level,
      x: x,
      y: y,
      spriteSource: game.spriteSources.enemy3,
      bulletType: 'targeted',
    });
  },
  'boss': function(game, level, x, y) {
    var bulletType = 'straight';
    if (level > 10) {
      bulletType = 'blast';
    }
    Enemy(game, level, {
      level: level,
      x: x,
      y: y,
      size: 50,
      health: (level * 10) - 2,
      spriteSource: game.spriteSources.enemy4,
      boosterDropChance: 100,
      bulletType: bulletType,
    });
  },
}

function Explosion(game, opts){
  var explosion = {
    game: game,
    endSize: opts.size,
    size: 1,
    x: opts.x,
    y: opts.y,
    started: (new Date).getTime(),
    life: opts.life || 1000,
    growRate: opts.size / opts.life,
  };
  explosion.getGraphic = function(spriteSource){
    var graphic = new PIXI.Sprite(PIXI.loader.resources[spriteSource].texture);
    graphic.width = 1;
    graphic.height = 1;
    graphic.anchor.x = 0.5;
    graphic.anchor.y = 0.5;
    graphic.x = explosion.x;
    graphic.y = explosion.y;
    game.engine.stage.addChild(graphic);
    return graphic;
  }
  explosion.logic = function(state){
    explosion.size = explosion.size + (explosion.growRate * state.elapsed);
    if (explosion.size > explosion.endSize){
      game.animations.remove(explosion);
      game.engine.stage.removeChild(explosion.graphic);
    }
    explosion.graphic.width = explosion.size;
    explosion.graphic.height = explosion.size;
  }
  explosion.graphic = explosion.getGraphic('img/_replace/explosion.png');
  explosion.game.animations.push(explosion);
  return explosion;
}

function Game(options){
  var game = {};
  game.height = window.innerHeight - 100;
  game.width = window.innerWidth;
  game.onWin = options.onWin || function(){console.log('You win!')};
  game.onLose = options.onLose || function(){console.log('You lose!')};
  game.numPlayers = options.players || 1;

  game.spriteSources = {
    player: 'img/_replace/ship.png',
    boosterAttack: 'img/booster-attack.png',
    boosterShield: 'img/booster-shield.png',
    boosterLife: 'img/_replace/booster-extra-life.png',
    enemy1: 'img/_replace/enemy1.png',
    enemy2: 'img/_replace/enemy2.png',
    enemy3: 'img/_replace/enemy3.png',
    enemy4: 'img/_replace/enemy4.png',
    explosion: 'img/_replace/explosion.png',
  };

  game.start = function(){
    game.engine = new Engine({
      viewport: 'viewport',
      spriteSources: game.spriteSources,
      width: game.width,
      height: game.height,
      onLoad: game.onEngineLoad
    })
  }

  game.nextLevel = function(){
    var loadTime = 2000;
    // Reset locations
    game.loading = true;
    game.resetBullets();
    for (const player of game.players) {
      player.speedBoost(2, loadTime);
    }

    setTimeout(function(){
      // Run the level constructor
      game.level += 1;
      game.spawnEnemies();
      game.loading = false;
    }, loadTime);
  }

  game.onEngineLoad = function(){
    game.sprites = game.engine.sprites;
    game.bullets = [];
    game.removeBullets = [];
    game.animations = [];
    game.boosters = [];
    game.enemies = [];
    game.players = [];
    // Make players
    for (let i=0;i<game.numPlayers;i++) {
      game.players.push(Player(game, {
        id: i,
        spriteSource: game.spriteSources.player,
        x: game.width / 2,
        y: game.height - 100,
        sprite: game.engine.sprites.player,
      }))
    }
    game.level = -1;
    game.nextLevel();
    game.bindKeys();
    game.loop();
    game.play = true;
  }

  game.bindKeys = function(){
    for (const player of game.players) {
      if (player.id === 0) {
        // Movement - WASD
        Mousetrap.bind('w', player.setKey('up', true), 'keydown');
        Mousetrap.bind('w', player.setKey('up', false), 'keyup');  
        Mousetrap.bind('s', player.setKey('down', true), 'keydown');
        Mousetrap.bind('s', player.setKey('down', false), 'keyup');
        Mousetrap.bind('a', player.setKey('left', true), 'keydown');
        Mousetrap.bind('a', player.setKey('left', false), 'keyup');
        Mousetrap.bind('d', player.setKey('right', true), 'keydown');
        Mousetrap.bind('d', player.setKey('right', false), 'keyup');

        Mousetrap.bind('space', player.setKey('fire', true), 'keydown');
        Mousetrap.bind('space', player.setKey('fire', false), 'keyup');
        Mousetrap.bind('q', player.setKey('shield', true), 'keydown');
        Mousetrap.bind('q', player.setKey('shield', false), 'keyup');

        // System
        Mousetrap.bind('enter', function(){
          game.lastStateUpdate = null;
          game.play = !game.play;
        });
        Mousetrap.bind('7 7 7', function() {
          game.players[0].applyWeapon('+1');
        });
        Mousetrap.bind('8 8 8', function() {
          game.players[0].shield.life += 1;
        });
        Mousetrap.bind('9 9 9', function() {
          game.players[0].lives += 1;
        });
      }
      else if (player.id === 1) {
        // Movement - Arrows
        Mousetrap.bind('up', player.setKey('up', true), 'keydown');
        Mousetrap.bind('up', player.setKey('up', false), 'keyup');  
        Mousetrap.bind('down', player.setKey('down', true), 'keydown');
        Mousetrap.bind('down', player.setKey('down', false), 'keyup');
        Mousetrap.bind('left', player.setKey('left', true), 'keydown');
        Mousetrap.bind('left', player.setKey('left', false), 'keyup');
        Mousetrap.bind('right', player.setKey('right', true), 'keydown');
        Mousetrap.bind('right', player.setKey('right', false), 'keyup');

        Mousetrap.bind('.', player.setKey('fire', true), 'keydown');
        Mousetrap.bind('.', player.setKey('fire', false), 'keyup');
        Mousetrap.bind(',', player.setKey('shield', true), 'keydown');
        Mousetrap.bind(',', player.setKey('shield', false), 'keyup');
      }
    }
  }

  game.getEnemyPositions = function(rowCount, enemyDistance, viewportPadding) {
    var halfWidth = (game.width / 2) - viewportPadding;
    var startY = viewportPadding;
    var centerX = game.width / 2;

    var positions = [];
    for ( var row=0; row<rowCount; row++ ) {
      var y = startY + (row * enemyDistance);

      if (row % 2 === 0) {
        // enemy in middle
        positions.push({x: centerX, y: y});
        
        var wingmenCount = Math.floor(halfWidth / enemyDistance);
        for ( var i=1; i<=wingmenCount; i++ ) {
          var distanceFromCenter = enemyDistance * i;
          var leftWingmanX = centerX - distanceFromCenter;
          var rightWingmanX =  centerX + distanceFromCenter;
          positions.push({x: leftWingmanX, y: y});
          positions.push({x: rightWingmanX, y: y});
        }
      } else {
        // space in middle
        var centerPadding = enemyDistance / 2;
        var sideCount = Math.floor((halfWidth - centerPadding) / enemyDistance);
        for ( var i=0; i<=sideCount; i++ ) {
          var distanceFromCenter = enemyDistance * i;
          var leftEnemyX = (centerX - centerPadding) - distanceFromCenter;
          var rightEnemyX = (centerX + centerPadding) + distanceFromCenter;
          positions.push({x: leftEnemyX, y: y});
          positions.push({x: rightEnemyX, y: y});
        }
      }
    }
    return positions;
  }

  game.spawnEnemies = function() {
    var viewportPadding = 50;

    // Determine enemy density/count 
    var rowCount;
    var enemyPadding;
    if (game.level <= 5) {
      rowCount = 1;
      enemyPadding = 200;
    } else if (game.level <= 10) {
      rowCount = 2;
      enemyPadding = 200;
    } else if (game.level <= 15) {
      rowCount = 2;
      enemyPadding = 150;
    } else if (game.level <= 20) {
      rowCount = 3;
      enemyPadding = 100;
    } else if (game.level <= 25) {
      rowCount = 4;
      enemyPadding = 100;
    } else {
      rowCount = 4;
      enemyPadding = 75;
    }

    // Determine type of enemies
    var enemies = [ENEMIES.basic]; 
    if (game.level > 4) {
      enemies.push(ENEMIES.randomizer);
    }
    if (game.level > 15) {
      enemies.push(ENEMIES.targeter);
    }

    ///////////////////////////////////////
    // Place Enemies
    var positions = game.getEnemyPositions(rowCount, enemyPadding, viewportPadding);
    var firstSpot = positions[0];
    var others = positions.slice(1);

    // Place first enemy
    var bossType = ENEMIES.boss;
    var boss = bossType(game, game.level, firstSpot.x, firstSpot.y);
    
    // Place all others
    for (var position of others) {
      var enemyType = randomChoice(enemies);
      var enemy = enemyType(game, game.level, position.x, position.y);
    }
  }

  game.loop = function (){
    requestAnimationFrame(game.loop);  
    if (game.play){
      game.updateState();
      game.engine.render();
    }
  }

  game.isOutsideViewport = function(x, y, size){
    if (x + size < 0 || x - size > game.width){
      return true;
    } else if (y + size < 0 || y - size > game.height) {
      return true;
    }
    return false;
  }
  
  game.move = function(obj, stateInfo, restrictToViewport){
    restrictToViewport = restrictToViewport || false;
    var x = obj.x + obj.vx * (stateInfo.elapsed / 100);
    var y = obj.y + obj.vy * (stateInfo.elapsed / 100);

    // Optionally restrict inside the bounding box of viewport
    if (restrictToViewport){
      var radius = obj.collisionRadius();
      x = Math.max(x, radius);
      y = Math.max(y, radius);
      x = Math.min(x, game.width - radius);
      y = Math.min(y, game.height - radius);
    }
    obj.x = x;
    obj.y = y;
    obj.graphic.x = x;
    obj.graphic.y = y;

  }

  game.resetBullets = function(){
    for (var bullet of game.bullets){
      bullet.graphic.visible = false;
      game.engine.stage.removeChild(bullet.graphic);
    }
    game.bullets = [];
  }

  game.updateState = function(){
    var lastTime = game.lastStateUpdate || (new Date).getTime();
    var currentTime = (new Date).getTime();
    var elapsed = lastTime ? currentTime - lastTime : null;
    var stateInfo = {lastStateTime: lastTime,currentStateTime: currentTime, elapsed: elapsed}

    // Movement and player logic
    scanGamepads(game);
    for (const player of game.players) {
      player.logic(stateInfo);
    }
    for (var enemy of game.enemies){
      enemy.logic(stateInfo);
    }
    for (var bullet of game.bullets){
      // Movement
      bullet.logic(stateInfo);
      // Collision
      if (bullet.enemy){
        for (const player of game.players) {
          if (distance(bullet, player) < player.collisionRadius() + bullet.collisionRadius()){
            player.collide(bullet);
          }
        }
      } else {
        for (var enemy of game.enemies){
          if (distance(bullet, enemy) < enemy.collisionRadius() + bullet.collisionRadius()){
            enemy.collide(bullet);
          }
        }
      }
    }
    // Remove used bullets
    for (var bullet of game.removeBullets){
      game.bullets.remove(bullet);
    }
    game.removeBullets = [];

    // Booster pick-up
    for (var booster of game.boosters){
      // Movement
      booster.logic(stateInfo);

      // Collision
      for (const player of game.players) {
        if (distance(booster, player) < player.collisionRadius() + booster.collisionRadius()){
          booster.boost(player);
        }
      }
    }

    // Animations
    for (var animation of game.animations){
      animation.logic(stateInfo);
    }

    // Conditionals
    if (game.enemies.length == 0 && !game.loading){
      game.nextLevel();
      game.loading = true;
    }
    if (game.players.length && !game.players.some((p) => p.hasLife())){
      game.end(false);
    }
    game.lastStateUpdate = currentTime;
  }

  game.end = function(won){
    game.play = false;
    if (won){
      game.onWin();
    } else {
      game.onLose();
    }
  }
  return game;
}
