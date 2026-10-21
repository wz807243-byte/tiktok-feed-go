package main

import (
	"context"
	"feedsystem_video_go/internal/config"
	"feedsystem_video_go/internal/db"
	"feedsystem_video_go/internal/middleware/logger"
	"feedsystem_video_go/internal/middleware/rabbitmq"
	rediscache "feedsystem_video_go/internal/middleware/redis"
	"feedsystem_video_go/internal/observability"
	"feedsystem_video_go/internal/social"
	"feedsystem_video_go/internal/video"
	"feedsystem_video_go/internal/worker"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	amqp "github.com/rabbitmq/amqp091-go"
	"gorm.io/gorm"
)

// connectWithRetry 指数退避重试，容器编排下依赖服务可能比本进程后就绪
func connectWithRetry(name string, maxRetries int, fn func() error) {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil {
			return
		}
		wait := time.Duration(1<<i) * time.Second
		if wait > 30*time.Second {
			wait = 30 * time.Second
		}
		logger.Printf("%s 不可用，%v 后重试 (%d/%d)...", name, wait, i+1, maxRetries)
		time.Sleep(wait)
	}
	logger.Fatalf("%s: 超过最大重试次数", name)
}

// runWorkerWithRetry 为每个 Worker 创建独立 Channel，断开后自动重连
func runWorkerWithRetry(ctx context.Context, name string, conn *amqp.Connection, fn func(*amqp.Channel) error) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		ch, err := conn.Channel()
		if err != nil {
			logger.Printf("%s: 创建 Channel 失败: %v, 5秒后重试", name, err)
			time.Sleep(5 * time.Second)
			continue
		}
		if err := ch.Qos(50, 0, false); err != nil {
			logger.Printf("%s: QoS 设置失败: %v", name, err)
		}

		logger.Printf("%s started, consuming", name)
		if err := fn(ch); err != nil {
			if ctx.Err() != nil {
				ch.Close()
				return
			}
			logger.Printf("%s: %v, 5秒后重连...", name, err)
		}
		ch.Close()
		time.Sleep(5 * time.Second)
	}
}

func main() {
	// 初始化 zap 日志（全项目日志统一走 internal/middleware/logger）
	logger.Init()
	if err := godotenv.Load(); err != nil {
		logger.Println(".env not found; continuing")
	}
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "configs/config.yaml"
	}
	logger.Printf("Loading config from %s", configPath)
	cfg, usedDefault, err := config.LoadLocalDev(configPath)
	if err != nil {
		logger.Fatalf("Failed to load config: %v", err)
	}
	if usedDefault {
		logger.Printf("Config File %s not found, using default local config", configPath)
	} else {
		logger.Printf("Config loaded from file: %s", configPath)
	}

	// MySQL（带重试）
	var sqlDB *gorm.DB
	connectWithRetry("MySQL", 10, func() error {
		var err error
		sqlDB, err = db.NewDB(cfg.Database)
		return err
	})
	defer db.CloseDB(sqlDB)

	cache, err := rediscache.NewFromEnv(&cfg.Redis)
	if err != nil {
		logger.Fatalf("Failed to create Redis client: %v", err)
	}
	defer cache.Close()
	connectWithRetry("Redis", 10, func() error {
		pingCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		return cache.Ping(pingCtx)
	})

	// RabbitMQ（带重试）
	url := "amqp://" + cfg.RabbitMQ.Username + ":" + cfg.RabbitMQ.Password + "@" + cfg.RabbitMQ.Host + ":" + strconv.Itoa(cfg.RabbitMQ.Port) + "/"
	var conn *amqp.Connection
	connectWithRetry("RabbitMQ", 10, func() error {
		var err error
		conn, err = amqp.Dial(url)
		return err
	})
	defer conn.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pprofServer, err := observability.NewPprofServer(
		"Worker",
		cfg.ObservabilityConfig.Pprof.Enabled,
		cfg.ObservabilityConfig.Pprof.WorkerAddr,
	)
	if err != nil {
		logger.Printf("Failed to start worker pprof server: %v", err)
	}
	if pprofServer != nil {
		defer pprofServer.Close()
	}

	likes := video.NewLiekRepostiory(sqlDB)
	videos := video.NewVideoRepositor(sqlDB)
	socials := social.NewSocialRepository(sqlDB)
	var consumers sync.WaitGroup
	startConsumer := func(name string, run func(*amqp.Channel) error) {
		consumers.Add(1)
		go func() {
			defer consumers.Done()
			runWorkerWithRetry(ctx, name, conn, run)
		}()
	}

	startConsumer("LikeWorker", func(ch *amqp.Channel) error {
		const queue = "like.events"
		if err := rabbitmq.DeclareTopic(ch, queue, queue, "like.*"); err != nil {
			return err
		}
		return worker.NewLikeWorker(ch, likes, videos, queue).Run(ctx)
	})
	startConsumer("PopularityWorker", func(ch *amqp.Channel) error {
		const queue = "video.popularity.events"
		if err := rabbitmq.DeclareTopic(ch, queue, queue, "video.popularity.*"); err != nil {
			return err
		}
		return worker.NewPopularityWorker(ch, cache, queue).Run(ctx)
	})
	startConsumer("SocialWorker", func(ch *amqp.Channel) error {
		const queue = "social.events"
		if err := rabbitmq.DeclareTopic(ch, queue, queue, "social.*"); err != nil {
			return err
		}
		return worker.NewSocialWorker(ch, socials, queue).Run(ctx)
	})

	<-ctx.Done()
	logger.Printf("Worker shutting down...")
	consumers.Wait()
	logger.Printf("Worker stopped")
}
