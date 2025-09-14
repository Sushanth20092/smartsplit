import React from "react";
import { View, Text, StyleSheet } from "react-native";

const PaymentHistoryScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment History</Text>
      {/* Add payment history UI here */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});

export default PaymentHistoryScreen;
