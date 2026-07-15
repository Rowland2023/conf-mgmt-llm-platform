// src/modules/ticket/infrastructure/persistence/models/TicketModel.js

import { DataTypes } from "sequelize";

export const TicketModelDefine = (sequelize) => {
  const Ticket = sequelize.define(
    "Ticket",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },

      conferenceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "conference_id",
        references: {
          model: "conferences",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      priceAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "price_amount",
      },

      priceCurrency: {
        type: DataTypes.CHAR(3),
        allowNull: false,
        defaultValue: "USD",
        field: "price_currency",
      },

      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      reserved: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      sold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      status: {
        type: DataTypes.ENUM("ACTIVE", "CANCELLED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "tickets",

      underscored: true,

      timestamps: true,

      // CRITICAL NOTE: If you manage optimistic locking manually inside your 
      // PostgresTicketRepository, leave this commented out to avoid double-incrementing.
      // version: "version", 

      indexes: [
        {
          fields: ["conference_id"],
        },
        {
          fields: ["status"],
        },
        {
          // Optimizes lookups for active ticket listings within a conference
          fields: ["conference_id", "status"],
        },
      ],
    }
  );

  return Ticket;
};