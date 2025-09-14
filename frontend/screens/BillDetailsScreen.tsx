import React from "react";
import { View, Text, StyleSheet } from "react-native";

const BillDetailsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bill Details</Text>
      {/* Add bill details UI here */}
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

export default BillDetailsScreen;
