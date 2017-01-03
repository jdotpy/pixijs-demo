Array.prototype.remove = function(obj){
  var index = this.indexOf(obj);
  if (index > -1){
    return this.splice(index, 1);  
  }
  return this;
}

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

function speedToVelocity(speed, angle){
  if (speed == 0){
    return {vx: 0, vy: 0};
  }
  return {
    vx: Math.sin(angle) * speed,
    vy: -1 * (Math.cos(angle) * speed),
  }
}

function distance(from, to) {
  var dx = from.x - to.x;
    var dy = from.y - to.y;
    var dist = Math.sqrt(dx*dx + dy*dy); 
  return dist;
}

function Engine(options){
  var engine = this;

  engine.loadSprites = function(){
    console.log('Loading Sprites')
    engine.sprites = {};
    var spriteList = [];
    for (var spriteKey of Object.keys(options.spriteSources)){
      spriteList.push(options.spriteSources[spriteKey])  ;
    }
    PIXI.loader.add(spriteList).load(function(){
      console.log('Sprites Loaded')
      for (var spriteKey of Object.keys(options.spriteSources)){
        var source = options.spriteSources[spriteKey];
        engine.sprites[spriteKey] = new PIXI.Sprite(PIXI.loader.resources[source].texture);
      }
      console.log('Loaded Sprites:', engine.sprites);
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
    Explosion(player.game, {x: bullet.x, y: bullet.y, size: 20, life: 300, spriteSource: 'img/_replace/explosion.png'});
    bullet.remove();
  }
  game.engine.stage.addChild(shield.graphic);
  return shield;
}

function Player(game, options){
  var player = {};
  player.alive = true;
  player.lives = options.lives || 3;
  player.x = options.x || 0;
  player.y = options.y || 0;
  player.startX = player.x;
  player.startY = player.y;
  player.size = options.size || 30;
  player.vx = 0;
  player.vy = 0;
  player.velocity = 25;
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

  player.getGraphic = function(sprite){
    var graphic = sprite;
    graphic.width = player.size;
    graphic.height = player.size;
    graphic.anchor.x = 0.5;
    graphic.anchor.y = 0.5;
    graphic.x = player.x;
    graphic.y = player.y;
    game.engine.stage.addChild(graphic);
    return graphic;
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
      counter: 1,
      fire: PLAYER_WEAPON.fire,
      color: 0x00FF00,
      enemy: false,
      size: 2, 
    }

    if (level < 5){
      weapon.pattern = PLAYER_WEAPON.patterns.singleShot;
      weapon.cooldown = 1000;
      weapon.speed = 10;
      weapon.damage = 1;
    } else {
      weapon.pattern = PLAYER_WEAPON.patterns.elevenShot;
      weapon.cooldown = 100;
      weapon.speed = 10;
      weapon.damage = 1;
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
      Explosion(player.game, {x: player.x, y: player.y, size: 3 * player.size, life: 300, spriteSource: 'img/_replace/explosion.png'});
    }
  }
  player.updateFromUser = function(key){
     if (key == 'up' || key == 'down' || key == 'right' || key == 'left'){
       player.updateVelocity();
     }
  }
  player.updateVelocity = function(){
    var keys = player.keys;
    var vx = 0;
    var vy = 0;
    if (keys.left){
      vx -= 1;
    }
    if (keys.right){
      vx += 1;
    }
    if (keys.up){
      vy -= 1;
    }
    if (keys.down){
      vy += 1;
    }
    if (vx != 0 && vy != 0){
      vx = Math.sqrt(.5) * vx;
      vy = Math.sqrt(.5) * vy;
    }
    player.vx = vx * player.velocity;
    player.vy = vy * player.velocity;
  }
  player.logic = function(stateInfo){
    if (player.alive){
      // Move
      player.game.move(player, stateInfo);

      // Fire
      if (player.keys.fire && !player.game.loading && stateInfo.currentStateTime - player.lastFire > player.weapon.cooldown){
        
        player.weapon.fire(player, player.weapon);
        player.lastFire = (new Date).getTime();
      }
    }
    player.shield.logic(stateInfo);
  }

  player.graphic = player.getGraphic(options.sprite);
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
  bullet.collisionRadius = bullet.size / 2;

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
  partialFiveShot: function(i){[
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {i: i, position: PLAYER_WEAPON.position.left, angle: -0.2},
    {i: i, position: PLAYER_WEAPON.position.right, angle: 0.2},
  ]},
  fiveShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle: -0.2},
    {position: PLAYER_WEAPON.position.right, angle: 0.2},
  ],
  sevenShot:[
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle: -0.2},
    {position: PLAYER_WEAPON.position.right, angle: 0.2},
    {position: PLAYER_WEAPON.position.left, angle: -0.4},
    {position: PLAYER_WEAPON.position.right, angle: -0.4},
  ],
  nineShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle: -0.2},
    {position: PLAYER_WEAPON.position.right, angle: 0.2},
    {position: PLAYER_WEAPON.position.left, angle: -0.4},
    {position: PLAYER_WEAPON.position.right, angle: 0.4},
    {position: PLAYER_WEAPON.position.left, angle: -0.6},
    {position: PLAYER_WEAPON.position.right, angle: 0.6},
  ],
  elevenShot: [
    {position: PLAYER_WEAPON.position.primary},
    {position: PLAYER_WEAPON.position.left},
    {position: PLAYER_WEAPON.position.right},
    {position: PLAYER_WEAPON.position.left, angle: -0.2},
    {position: PLAYER_WEAPON.position.right, angle: 0.2},
    {position: PLAYER_WEAPON.position.left, angle: -0.4},
    {position: PLAYER_WEAPON.position.right, angle: 0.4},
    {position: PLAYER_WEAPON.position.left, angle: -0.6},
    {position: PLAYER_WEAPON.position.right, angle: 0.6},
    {position: PLAYER_WEAPON.position.left, angle: -0.8},
    {position: PLAYER_WEAPON.position.right, angle: 0.8},
  ],
}
PLAYER_WEAPON.fire = function(player, weapon){
  weapon.counter = (weapon.counter + 1) % 100;
  for (var b of weapon.pattern){
    // Allow for the skipping of bullets that only fire on certain iterations
    if (b.i && !(weapon.counter % b.i == 0)){
      console.log('skipping trigger')
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
    console.log('Firing bullet with opts:', b, opts);
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
  booster.collisionRadius = booster.size / 2;

  if (booster.type == 'life'){
    booster.spriteSource = game.spriteSources.boosterLife;
  } else if (booster.type == 'attack'){
    booster.spriteSource = game.spriteSources.boosterAttack;
  } else if (booster.type == 'shield'){
    booster.spriteSource = game.spriteSources.boosterShield;
  }

  // Functions
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
  if (!(getRandom(0, 100) < percentChance)){
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

function Enemy(game, opts){
  var enemy = {};

  enemy.x = opts.x;
  enemy.y = opts.y;
  enemy.size = opts.size;
  enemy.vx = opts.vx;
  enemy.vy = opts.vy;
  enemy.health = opts.health || 1;
  enemy.game = game;
  enemy.size = 30;
  enemy.cooldown = opts.cooldown || 500;
  enemy.bulletSpeed = opts.bulletSpeed || 30;
  enemy.collisionRadius = enemy.size / 2;
  enemy.bulletType = opts.bulletType || 'straight';

  enemy.die = function(){
    game.enemies.remove(enemy);
    game.engine.stage.removeChild(enemy.graphic);
    makeRandomBooster(game, 40, enemy.x, enemy.y);
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

  enemy.emitBullet = function(){
    var vy = enemy.bulletSpeed;
    var vx;
    switch (enemy.bulletType){
      case 'random':
        vx = getRandom(-8,8);
        break;
      case 'straight':
      default:
        vx = 0;
    }
    Bullet(enemy.game, {
      x: enemy.x,
      y: enemy.y,
      vx: vx,
      vy: enemy.bulletSpeed,
      enemy: true,
      color: 0xe74c3c,
      size: 2
    })
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
      enemy.emitBullet();
    }
  }

  enemy.graphic = enemy.getGraphic(opts.spriteSource);
  game.enemies.push(enemy);
  return enemy;
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
  explosion.graphic = explosion.getGraphic(opts.spriteSource);
  explosion.game.animations.push(explosion);
  return explosion;
}

TEST_LEVEL = function(game){
  Enemy(game, {health: 5, x: 100, y: 100, size: 100, spriteSource: game.spriteSources.enemy, bulletSpeed: 15, cooldown: 1000});
  Booster(game, {type: 'shield', x:game.width / 2, y:500, size: 30});
  Booster(game, {type: 'shield', x:game.width / 2, y:400, size: 30});
  Booster(game, {type: 'attack', x:game.width / 2, y:300, size: 30});
  Booster(game, {type: 'attack', x:game.width / 2, y:200, size: 30});
}
LEVELS = [
  //TEST_LEVEL,
  function(game){
    Enemy(game, {x: 200, y: 100, size: 100, spriteSource: game.spriteSources.enemy1, bulletSpeed: 15, cooldown: 1000});
    Enemy(game, {x: 400, y: 100, size: 100, spriteSource: game.spriteSources.enemy2, bulletSpeed: 15, cooldown: 1000});
    Enemy(game, {x: 600, y: 100, size: 100, spriteSource: game.spriteSources.enemy3, bulletSpeed: 15, cooldown: 1000});
    Enemy(game, {x: 600, y: 100, size: 100, spriteSource: game.spriteSources.enemy4, bulletSpeed: 15, cooldown: 1000});
  },
  function(game){
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
  },
  function(game){
    Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random', bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random', bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletSpeed: 30, cooldown: 1000});
  },
  function(game){
    Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy});
  },
  function(game){
    Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
  },
  function(game){
    Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 50, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 150, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 250, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 350, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 450, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 550, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
    Enemy(game, {x: 650, y: 200, size: 10, spriteSource: game.spriteSources.enemy});
  },
  function(game){
    Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 50, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 150, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 250, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 350, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 450, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 550, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 650, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
  },
  function(game){
    Enemy(game, {x: 100, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 200, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 300, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 400, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 500, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 600, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 700, y: 100, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 50, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 150, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 250, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 350, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 450, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 550, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
    Enemy(game, {x: 650, y: 200, size: 10, spriteSource: game.spriteSources.enemy, bulletType: 'random'});
  },
];

function Game(options){
  var game = {};
  game.height = window.innerHeight - 100;
  game.width = window.innerWidth;
  game.onWin = options.onWin || function(){console.log('You win!')};
  game.onLose = options.onLose || function(){console.log('You lose!')};

  game.spriteSources = {
    player: 'img/_replace/ship.png',
    boosterAttack: 'img/booster-attack.png',
    boosterShield: 'img/booster-shield.png',
    boosterLife: 'img/_replace/booster-extra-life.png',
    enemy1: 'img/_replace/enemy1.png',
    enemy2: 'img/_replace/enemy2.png',
    enemy3: 'img/_replace/enemy3.png',
    enemy4: 'img/_replace/enemy4.png',
    enemy: 'img/_replace/enemy.png',
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
    // Reset locations
    game.loading = true;
    game.resetBullets();
    setTimeout(function(){
      
      // Run the level constructor
      game.level += 1;
      if (game.level < LEVELS.length){
        LEVELS[game.level](game);
      } else{
        game.play = false;
        game.end(false);
      }
      game.loading = false;
    }, 2000);
  }

  game.onEngineLoad = function(){
    game.sprites = game.engine.sprites;
    game.bullets = [];
    game.removeBullets = [];
    game.animations = [];
    game.boosters = [];
    game.enemies = [];
    game.player = Player(game, {
      x: game.width / 2,
      y: game.height - 100,
      sprite: game.engine.sprites.player,
    })
    game.level = -1;
    game.nextLevel();
    game.bindKeys();
    game.loop();
    game.play = true;
  }

  game.bindKeys = function(){
    function playerKey(key, on){
      return function(){
        game.player.keys[key] = on;
        game.player.updateFromUser(key);
      }
    }
    
    // Movement - Arrows
    Mousetrap.bind('up', playerKey('up', true), 'keydown');
    Mousetrap.bind('up', playerKey('up', false), 'keyup');  
    Mousetrap.bind('down', playerKey('down', true), 'keydown');
    Mousetrap.bind('down', playerKey('down', false), 'keyup');
    Mousetrap.bind('left', playerKey('left', true), 'keydown');
    Mousetrap.bind('left', playerKey('left', false), 'keyup');
    Mousetrap.bind('right', playerKey('right', true), 'keydown');
    Mousetrap.bind('right', playerKey('right', false), 'keyup');
    // Movement - WASD
    Mousetrap.bind('w', playerKey('up', true), 'keydown');
    Mousetrap.bind('w', playerKey('up', false), 'keyup');  
    Mousetrap.bind('s', playerKey('down', true), 'keydown');
    Mousetrap.bind('s', playerKey('down', false), 'keyup');
    Mousetrap.bind('a', playerKey('left', true), 'keydown');
    Mousetrap.bind('a', playerKey('left', false), 'keyup');
    Mousetrap.bind('d', playerKey('right', true), 'keydown');
    Mousetrap.bind('d', playerKey('right', false), 'keyup');

    // Actions
    Mousetrap.bind('space', playerKey('fire', true), 'keydown');
    Mousetrap.bind('space', playerKey('fire', false), 'keyup');
    Mousetrap.bind('q', game.player.shield.activate, 'keydown');
    Mousetrap.bind('q', game.player.shield.deactivate, 'keyup');

    // System
    Mousetrap.bind('enter', function(){
      game.lastStateUpdate = null;
      game.play = !game.play;
    });

    // Cheat
    Mousetrap.bind('7 7 7', function() {
      game.player.applyWeapon('+!');
    });
    Mousetrap.bind('8 8 8', function() {
      game.player.shield.life += 1;
    });
    Mousetrap.bind('9 9 9', function() {
      game.player.lives += 1;
    });
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
  
  game.move = function(obj, stateInfo){
    obj.x = obj.x + obj.vx * (stateInfo.elapsed / 100);
    obj.y = obj.y + obj.vy * (stateInfo.elapsed / 100);
    obj.graphic.x = obj.x;
    obj.graphic.y = obj.y;
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
    game.player.logic(stateInfo);
    for (var enemy of game.enemies){
      enemy.logic(stateInfo);
    }
    for (var bullet of game.bullets){
      // Movement
      bullet.logic(stateInfo);
      // Collision
      if (bullet.enemy){
        if (distance(bullet, game.player) < game.player.collisionRadius() + bullet.collisionRadius){
          game.player.collide(bullet);
        }
      } else {
        for (var enemy of game.enemies){
          if (distance(bullet, enemy) < enemy.collisionRadius + bullet.collisionRadius){
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

    for (var booster of game.boosters){
      // Movement
      booster.logic(stateInfo);

      // Collision
      if (distance(booster, game.player) < game.player.collisionRadius() + booster.collisionRadius){
        booster.boost(game.player);
      }
    }
    for (var bullet of game.bullets){
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
    if (!game.player.alive && !game.player.lives){
      game.end(false);
    }
    game.lastStateUpdate = currentTime;
  }

  game.end = function(won){
    if (won){
      game.onWin();
    } else {
      game.onLose();
    }
  }
  return game;
}
